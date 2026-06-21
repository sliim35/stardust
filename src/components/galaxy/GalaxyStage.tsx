import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BackdropPoint } from "#/lib/galaxy/backdrop";
import { MW_PLACEMENT } from "#/lib/galaxy/backdrop";
import {
  constellationNodes,
  constellationSegments,
  figureColor,
  figureForGroup,
  hoverAffordanceFor,
} from "#/lib/galaxy/constellation";
import { type DeepLinkSearch, resolveDeepLink } from "#/lib/galaxy/deep-link";
import { createFocusController } from "#/lib/galaxy/focus";
import {
  enteredObjectFor,
  type PlacedGalaxy,
} from "#/lib/galaxy/galaxy-render";
import {
  LG_MW_PLACEMENT,
  lgGalaxies,
  lgGoldAccents,
  lgHitTargets,
  lgLabels,
} from "#/lib/galaxy/lg-composition";
import { paletteAccentVars } from "#/lib/galaxy/palette";
import { HOME_MILKY_WAY_ID, REAL_OBJECTS } from "#/lib/galaxy/realdata";
import { HOME_GALAXY_ID } from "#/lib/galaxy/scenegraph";
import { createInMemoryStore } from "#/lib/galaxy/store";
import { createD1Store } from "#/lib/galaxy/store-d1";
import { HOME_TIER } from "#/lib/galaxy/tier-nav";
import {
  arrivalNarration,
  createTierTransitionController,
  departNarration,
  entryNarration,
  type TierTransitionEvent,
} from "#/lib/galaxy/tier-transition";
import type { MemoryStar, Tier } from "#/lib/galaxy/types";
import { getMessages, useLocale } from "#/lib/i18n";
import type { Messages } from "#/lib/i18n/types";
import { BackdropTint } from "./BackdropTint";
import { CardHost } from "./CardHost";
import { ChromeOverlay } from "./ChromeOverlay";
import { ConstellationOverlay } from "./ConstellationOverlay";
import { DeepStarfield } from "./DeepStarfield";
import { GalaxyBackdrop } from "./GalaxyBackdrop";
import { LgGalaxyLabels } from "./LgGalaxyLabels";
import { MemoryStarLayer } from "./MemoryStarLayer";
import { StarSearch } from "./StarSearch";
import { useGalaxyCamera } from "./useGalaxyCamera";
import { useObjectClick } from "./useObjectClick";
import { useObjectNarration } from "./useObjectNarration";
import { usePalette } from "./usePalette";
import { useStageFit } from "./useStageFit";
import { useTierNav } from "./useTierNav";
import { useTimedNarration } from "./useTimedNarration";

/** Mirrors the `memIgnite` CSS animation duration (1.5s) — one ignite number. */
const IGNITE_MS = 1500;

/** Minimum on-screen dwell per ASTRO narration phrase (#183) — long enough to read a
 *  tier line before the next replaces it (owner: "at least 3s between phrases"). */
const NARRATION_MIN_MS = 3000;

/** Stable empty sets — the home/MW scene paints no Layer-A galaxies or gold. */
const NO_NEIGHBOURS: readonly PlacedGalaxy[] = [];
const NO_GOLD: readonly BackdropPoint[] = [];

/**
 * The top-level galaxy scene (#4): composes L1 (deep starfield) · L2 (the disk)
 * · L3 (memory stars) under an eased camera + parallax, contain-fit to the
 * viewport. Renders the **home galaxy as the tier-2 node** of the universe
 * (ADR-0008 §3, #126): the sky is read via the home-galaxy projection
 * `skyFor(HOME_GALAXY_ID)` rather than the bare `getSky()`. The two are
 * byte-identical (the flat `GalaxySky` *is* the tier-2 home projection), so the
 * render is unchanged — this just routes the data through the scene graph. It
 * ignites any star added through the seam without moving the rest (AC3); live
 * producers (Telegram ingestion) arrive in epic #8. Tier transitions / descent
 * (#125) and LOD/breadcrumb (#112) build on this.
 *
 * SSR-safe: the disk/deep-field canvases draw client-side, while the DOM memory
 * layer + chrome render server-side over the seeded CSS starfield placeholder
 * (ADR-0003).
 */
type GalaxyStageProps = {
  /** The arrival URL's wayfinding params (#129) — consumed once on mount. */
  deepLink?: DeepLinkSearch;
  /**
   * The SSR-fetched persisted user stars (#183, ADR-0012 §4). When present the
   * store is `createD1Store(userStars)` — seed fixtures merged with the persisted
   * user stars at construction (seeds are never written to D1). Absent (tests /
   * dev with no binding) → the seed-only `createInMemoryStore()` fallback.
   */
  userStars?: MemoryStar[];
};

export const GalaxyStage = ({ deepLink, userStars }: GalaxyStageProps = {}) => {
  // Build once from the SSR snapshot so the store identity is stable across
  // re-renders (the snapshot is request-frozen loader data). `createD1Store`
  // merges seeded + user; the in-memory fallback covers tests/dev (no binding).
  const [store] = useState(() =>
    userStars ? createD1Store(userStars) : createInMemoryStore(),
  );
  // Which galaxy the scene currently shows (BR22-frame #198): the home MW on landing,
  // re-keyed at the tier-transition threshold so a neighbour entry swaps to ITS disk.
  // `null` ≡ the home MW (skyFor('home') ≡ getSky() byte-for-byte) — the back-compat
  // default. Drives both the disk projection and the store-subscribe re-read below.
  const [displayedGalaxyId, setDisplayedGalaxyId] = useState<string | null>(
    null,
  );
  const galaxyForSky = displayedGalaxyId ?? HOME_GALAXY_ID;
  const [sky, setSky] = useState(
    () => store.skyFor?.(HOME_GALAXY_ID) ?? store.getSky(),
  );
  const [ignitingIds, setIgnitingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const skyRef = useRef(sky);
  skyRef.current = sky;
  // The displayed galaxy in a ref so the long-lived store-subscribe closure re-reads
  // the CURRENT projection on an ignite, never a stale capture.
  const galaxyForSkyRef = useRef(galaxyForSky);
  galaxyForSkyRef.current = galaxyForSky;

  // Swap the disk to the focused galaxy's projection whenever the displayed galaxy
  // changes (the threshold scene-swap). The neighbour disks are figure-empty at launch
  // (the empty-galaxy first-class state, AC3); the home MW projects to its live sky.
  useEffect(() => {
    setSky(store.skyFor?.(galaxyForSky) ?? store.getSky());
  }, [store, galaxyForSky]);

  useEffect(() => {
    // Track the per-star ignite timers so they're cleared on unmount / re-run —
    // otherwise an in-flight timer fires `setIgnitingIds` on an unmounted
    // component and leaks (latent until a live producer in epic #8).
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsubscribe = store.subscribe?.((_next) => {
      // Re-project onto the displayed galaxy: an append targets the home sky, so a
      // neighbour stays on its own (empty) disk rather than adopting the home stars.
      const next = store.skyFor?.(galaxyForSkyRef.current) ?? store.getSky();
      const known = new Set(skyRef.current.stars.map((s) => s.id));
      const fresh = next.stars.filter((s) => !known.has(s.id)).map((s) => s.id);
      setSky(next);
      if (fresh.length === 0) return;
      setIgnitingIds((cur) => new Set([...cur, ...fresh]));
      for (const id of fresh) {
        timers.push(
          setTimeout(() => {
            setIgnitingIds((cur) => {
              const n = new Set(cur);
              n.delete(id);
              return n;
            });
          }, IGNITE_MS),
        );
      }
    });
    return () => {
      unsubscribe?.();
      for (const t of timers) clearTimeout(t);
    };
  }, [store]);

  const [palette, setPalette] = usePalette();
  // Override only the backdrop tint with the picked theme (#44); memoized so the
  // disk redraws on theme/seed change, not on every ignite re-render.
  const backdrop = useMemo(
    () => ({ ...sky.backdrop, palette }),
    [sky.backdrop, palette],
  );
  const scale = useStageFit();
  const m = getMessages(useLocale());

  // The tier-transition seam (slice F, #125): the *displayed* tier (what the
  // scene + scale net render) follows the timeline's threshold event, NOT the
  // nav state — so the scene swaps mid-flight, exactly where the camera crosses
  // the threshold framing. `narration` is ASTRO's transition line (depart on
  // launch, on-arrival when the tier settles), resolved from the catalog by the
  // pure lib routing — hardcoded i18n, the post-v1 ASTRO-AI swap seam.
  const [transitions] = useState(() => createTierTransitionController());
  const [displayedTier, setDisplayedTier] = useState<Tier>(HOME_TIER);
  // ASTRO narration with a minimum dwell so tier lines stay readable (#183): the
  // depart→arrive swap is gated to ≥3s even though the camera moves faster.
  const {
    narration,
    show: showNarration,
    clear: clearNarration,
  } = useTimedNarration(NARRATION_MIN_MS);
  // A deep-linked star whose dive is still in flight (#129): focusing while the
  // tier timeline runs would KILL it (the #167 kill path) and strand the scene
  // swap, so the focus waits for the transition's terminal `arrive`.
  const pendingDeepLinkStar = useRef<string | null>(null);
  const onTransitionEvent = (e: TierTransitionEvent) => {
    if (e.kind === "depart") {
      showNarration(departNarration(m.astroNarration, e.direction, e.to));
      return;
    }
    // Both `threshold` (the mid-flight scene swap) and `arrive` carry the
    // authoritative displayed tier + galaxy (BR22-frame #198). `arrive` matters
    // for the kill path: a focus move that kills a transition after its threshold
    // fired resolves the displayed tier to the nav tier — the logical source of
    // truth — via the terminal arrive (#167 review, code-style "terminal events
    // on kill/cancel"). The galaxy id drives the disk swap (the re-key effect above).
    setDisplayedTier(e.tier);
    setDisplayedGalaxyId(e.galaxyId);
    if (e.kind === "arrive") {
      // The galaxy tier speaks the FOCUSED galaxy's entry line (per-galaxy lore,
      // BR22 slice 5); every other tier keeps its curated onArrival line.
      showNarration(
        e.tier === "galaxy"
          ? entryNarration(m.astroNarration, m.lore, e.galaxyId)
          : arrivalNarration(m.astroNarration, e.tier),
      );
      const pendingStar = pendingDeepLinkStar.current;
      if (pendingStar) {
        pendingDeepLinkStar.current = null;
        focus.focusStar(pendingStar);
      }
    }
  };

  // ASTRO narration on object focus (#184, ADR-0013 §2): opening a real object's
  // lore card ALSO asks the cached-narration server fn for an AI interesting fact
  // and routes a hit through this SAME `narration` seam — layering cleanly with
  // #183's add-star confirmation + the tier lines (last-writer-wins, no race).
  // Routes through the dwell-gated `showNarration` (#183 redesign on main) so an AI
  // fact honours the ≥3s readability dwell just like the tier lines, rather than the
  // pre-redesign raw setter. Graceful: a null result (AI/KV absent/failing) leaves
  // the bubble untouched.
  const onNarrate = useObjectNarration(showNarration, m.lore);

  // The focus-by-id seam (#111): a stable controller other features (#5 deep-link,
  // #113 search) call to ease the camera onto a star by id. The camera hook
  // resolves the id against the live sky (`skyRef`) and drives the eased move.
  const [focus] = useState(() => createFocusController());
  const cam = useGalaxyCamera({
    focus,
    getSky: () => skyRef.current,
    transitions,
    onTransitionEvent,
  });

  // The guided-navigation spine (slice E, #153): scroll steps the tier-zoom state
  // and `nav.diveTo` is the gateway-dive sink for clicks. The camera *follows*
  // the nav state (slice F): a tier flip requests the eased timeline below.
  const nav = useTierNav();
  // Breadcrumb nav (owner 2026-06-10): a click on a non-active reachable segment
  // routes through the SAME spine — LOCAL GROUP ascends, MILKY WAY dives home —
  // so the breadcrumb gets the #167 eased timelines + narration for free.
  const { ascend, diveTo } = nav;
  // The galaxy crumb dives back into the CURRENTLY-focused galaxy (BR22-frame #198), not
  // the hardcoded home MW — once you can be inside Andromeda, ascending solarSystem→galaxy
  // must stay in Andromeda. Falls back to the home MW when no galaxy is focused (the
  // crumb only shows under the MW in v1; the dynamic label lands in slice 4).
  const navGalaxyId = nav.state.galaxyId;
  const onTierSelect = useCallback(
    (target: Tier) => {
      if (target === "localGroup") ascend();
      else if (target === "galaxy")
        diveTo(navGalaxyId ?? HOME_MILKY_WAY_ID, "galaxy");
    },
    [ascend, diveTo, navGalaxyId],
  );
  const prevTier = useRef(nav.state.tier);
  useEffect(() => {
    const from = prevTier.current;
    const to = nav.state.tier;
    if (from === to) return;
    prevTier.current = to;
    // Thread the focused galaxy so the scene-swap renders its disk + lore (the camera
    // target stays the shared DEFAULT_FRAMING — identity, not geometry).
    transitions.request(from, to, nav.state.galaxyId);
  }, [nav.state.tier, nav.state.galaxyId, transitions]);

  // Wayfinding deep-links (#129): the ARRIVAL url (`?at=` / `?star=`) resolves
  // once on mount — a shared link is an arrival behavior, not a live
  // subscription; in-app navigation owns the camera afterwards. The dive rides
  // the normal nav spine, so the #167 eased timeline + ASTRO narration fire
  // exactly as if the visitor had navigated by hand; a star focus that needs
  // the tier flip parks in `pendingDeepLinkStar` and flushes on `arrive`
  // (above), while a same-tier star focuses immediately. Resolution is pure
  // (`lib/galaxy/deep-link`) and resolves every malformed/unknown input to
  // `null` upstream — a broken link renders the default view, never a crash
  // (AC3). Client-only by construction (an effect), so SSR markup is
  // byte-identical with or without params (ADR-0003).
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current || !deepLink) return;
    deepLinkConsumed.current = true;
    const target = resolveDeepLink(deepLink, {
      findReal: (id) => REAL_OBJECTS.find((o) => o.id === id),
      findStar: (id) => skyRef.current.stars.find((s) => s.id === id),
    });
    if (!target) return;
    if (target.dive.tier !== nav.state.tier) {
      pendingDeepLinkStar.current = target.star;
      nav.diveTo(target.dive.id, target.dive.tier);
    } else if (target.star) {
      focus.focusStar(target.star);
    }
  }, [deepLink, nav, focus]);

  // The scene swap (#125 → composed by I-2 #112): at the Local-Group tier the
  // disk paints the FINAL-proof composition — the MW shrunk (LG_MW_PLACEMENT) +
  // the 3 neighbours spread per `lg-composition` + the gold accents — and the
  // L3 memory layer (MW-interior content) hides below. Memoized so the canvas
  // only redraws when the displayed tier actually swaps.
  const lgView = displayedTier === "localGroup";
  const neighbours = useMemo(
    () => (lgView ? lgGalaxies() : NO_NEIGHBOURS),
    [lgView],
  );
  const goldDust = useMemo(
    () => (lgView ? lgGoldAccents() : NO_GOLD),
    [lgView],
  );
  // The entered (tier-2) galaxy whose OWN morphology the backdrop must paint (#226):
  // a non-home neighbour at the galaxy tier; null at the LG overview or home MW (the
  // untouched grand-spiral path). The disk swaps to its real shape, not the MW twin.
  const enteredObject = useMemo(
    () => (lgView ? null : enteredObjectFor(displayedGalaxyId)),
    [lgView, displayedGalaxyId],
  );

  // The hovered LG galaxy (#174): its id flows to `GalaxyBackdrop` as `highlight`,
  // blooming that galaxy's own point cloud (replacing the removed in-DOM `oreol`).
  // Gated by `lgView` exactly like the #154 hover above: the backdrop only blooms
  // while we're on the LG tier, so a hover live at descend-start can't strand a
  // bloom across the dive (the LgGalaxyLabels layer unmounts with the tier anyway,
  // but gating the prop keeps the highlight from outliving the view in any race).
  const [lgHovered, setLgHovered] = useState<string | null>(null);
  const lgHighlight = lgView ? lgHovered : null;
  // Reset the stale hover id whenever we leave the LG tier. The labels layer
  // unmounts on the descend, so its pointer-leave never fires — without this, a
  // hover live at descend-start would re-bloom that same galaxy on the next ascend
  // (the pointer long gone from it). Clearing the source state keeps the return to
  // the LG overview clean.
  useEffect(() => {
    if (!lgView) setLgHovered(null);
  }, [lgView]);

  // Hover (#154, spec §3 + owner rules 2026-06-06): the star under the pointer/
  // keyboard-focus. When it belongs to an AUTHORED mood-pure figure, the overlay
  // draws the figure's designed edges in the figure's ONE mood colour and
  // everything else dims; a solo star (Mom's, the figure-less moods) fades up
  // only its short description. Pure derivation — `constellation.ts` owns the
  // rules (mood-validated membership, never `deep`, authored edges only).
  // Gated off the Local-Group view (I-2): L3 hides there, and a hover that was
  // live when the ascend started must not strand the dim/overlay on Layer A.
  const [hovered, setHovered] = useState<MemoryStar | null>(null);
  const constellation = useMemo(() => {
    if (lgView || hovered === null) return null;
    const affordance = hoverAffordanceFor(hovered);
    if (affordance.kind !== "memory" || affordance.group === null) return null;
    const figure = figureForGroup(affordance.group);
    if (figure === null) return null;
    const segments = constellationSegments(sky.stars, figure);
    if (segments.length === 0) return null; // a degenerate figure reads as solo
    return {
      segments,
      color: figureColor(figure),
      litIds: new Set(constellationNodes(sky.stars, figure).map((n) => n.id)),
    };
  }, [lgView, hovered, sky.stars]);
  // The "dim everything else" cross-fade on the far layers (L1 + the disk) —
  // instant under prefers-reduced-motion (AC7).
  const dimClass = `transition-opacity duration-300 motion-reduce:transition-none ${
    constellation ? "opacity-40" : "opacity-100"
  }`;

  return (
    <div
      className="galaxy-stage"
      ref={cam.stage}
      // Publish the active accent onto the shared @theme vars so chrome utilities
      // (text-accent, border-accent, focus rings) re-tint with the picked sky.
      style={paletteAccentVars(palette) as CSSProperties}
      onPointerMove={cam.onPointerMove}
      onPointerLeave={cam.onPointerLeave}
      onWheel={nav.onWheel}
    >
      {/* The card host provides `openCard` to the interactive layers it wraps and
          renders the one open card over a fixed full-viewport overlay (no DOM in
          the camera tree). Clicks become cards here for the first time (slice E). */}
      <CardHost>
        {/* Layer A — full-bleed space: nebula tint + L1 starfield (carries cam.l1,
            the farthest/slowest parallax plane). Decorative. */}
        <div
          className={`absolute inset-0 [will-change:transform] ${dimClass}`}
          ref={cam.l1}
          aria-hidden="true"
        >
          <BackdropTint palette={palette} />
          <DeepStarfield />
        </div>
        {/* Layer B — the contain-fit stage: disk glow (L2, transparent) + memory
            stars (L3), scaled by --stage-scale and centered. */}
        <div
          className="galaxy-stage__fit"
          ref={cam.fit}
          style={{ "--stage-scale": scale } as CSSProperties}
        >
          <div className="galaxy-stage__camera" ref={cam.cam}>
            <div className={`galaxy-l2-wrap ${dimClass}`} ref={cam.l2}>
              <GalaxyBackdrop
                backdrop={backdrop}
                homePlacement={lgView ? LG_MW_PLACEMENT : MW_PLACEMENT}
                enteredObject={enteredObject}
                neighbours={neighbours}
                goldDust={goldDust}
                highlight={lgHighlight}
              />
              {/* Serif/mono galaxy titles ride the L2 plane so they track the
                  framing + parallax exactly like the disks they annotate.
                  Hover reveals the title (#167); a click routes through the
                  shared object-click seam — the MW gateway dives, a neighbour
                  opens its lore card (#169). Unmounts with the LG view, so the
                  MW tier's memory-star interaction is untouched. */}
              {lgView && (
                <LgInteractiveLabels
                  diveTo={nav.diveTo}
                  lore={m.lore}
                  onActiveChange={setLgHovered}
                  onNarrate={onNarrate}
                />
              )}
            </div>
            {/* The L3 memory layer is MW-interior content: at the Local-Group
                tier it fades with the threshold swap (motion-reduce snaps) and
                drops its pointer + keyboard affordances (visibility removes the
                star buttons from the tab order; pointer-events guards the fade
                window). */}
            <div
              className={`galaxy-l3-wrap transition-[opacity,visibility] duration-500 motion-reduce:transition-none ${
                lgView ? "pointer-events-none invisible opacity-0" : ""
              }`}
              ref={cam.l3}
            >
              {constellation && (
                <ConstellationOverlay
                  segments={constellation.segments}
                  color={constellation.color}
                />
              )}
              <InteractiveStars
                stars={sky.stars}
                ignitingIds={ignitingIds}
                diveTo={nav.diveTo}
                a11yLabel={m.a11y.memoryStar}
                moodLabels={m.moods}
                onHoverChange={setHovered}
                litIds={constellation?.litIds ?? null}
              />
            </div>
          </div>
        </div>
        {/* Layer C — viewport-fixed chrome overlay (title · breadcrumb · live count
            · ASTRO · palette), pinned at fixed px so it never scales with the
            stage. See ChromeOverlay for the why. */}
        <ChromeOverlay
          count={sky.stars.length}
          palette={palette}
          onPaletteChange={setPalette}
          tier={displayedTier}
          // The breadcrumb reads the THRESHOLD-following galaxy id (BR21, #199), the
          // same one driving the disk swap, so the trail shape + galaxy name flip in
          // lockstep with the scene — not at nav-request time (the #125 hysteresis).
          galaxyId={displayedGalaxyId}
          onTierSelect={onTierSelect}
          narration={narration}
          onNarrationDismiss={clearNarration}
          // "Add your star" (#183, dir. A) lives IN ASTRO's bubble — one surface,
          // no panel colliding with the bubble/sprite. The CTA shows only at the
          // Milky-Way tier (memory stars hide on the Local-Group overview); a saved
          // star ignites via the store seam (the subscribe effect above) and ASTRO
          // speaks the confirmation in its own bubble.
          onStarAdded={(star) => store.addStar(star)}
          canAddStar={!lgView}
        />
        {/* Discovery search (#113) — a viewport-fixed chrome panel that finds a
            memory star by text/mood/colour and frames it via the focus-on-star
            primitive (#111). Lives only at the Milky-Way tier: memory stars are
            MW-interior content (the L3 layer hides on the Local-Group overview),
            so the index is meaningless there. Selecting a result eases the camera
            onto the star — the same primitive the deep-link path uses. */}
        {!lgView && (
          <SearchChromeMount
            stars={sky.stars}
            onSelect={(id) => focus.focusStar(id)}
          />
        )}
      </CardHost>
    </div>
  );
};

/**
 * The discovery search panel (#113) mounted as viewport-fixed chrome — a child of
 * the stage so it reads the live sky + the focus controller. Positioned top-right
 * (reflows to a left-anchored row below 620px); selecting a result eases the camera
 * onto the star via the focus-on-star primitive (#111). Extracted as a named
 * component per the chrome convention (#92): the stage declares *what* composes the
 * scene, this owns *how* the panel is placed.
 */
const SearchChromeMount = ({
  stars,
  onSelect,
}: {
  stars: readonly MemoryStar[];
  onSelect: (id: string) => void;
}) => (
  <div className="pointer-events-none fixed top-[max(70px,calc(env(safe-area-inset-top)+48px))] right-[max(28px,env(safe-area-inset-right))] z-[55] flex max-[620px]:left-[max(28px,env(safe-area-inset-left))] max-[620px]:justify-end">
    <StarSearch stars={stars} onSelect={onSelect} />
  </div>
);

/**
 * The L3 memory layer made interactive — a child of `<CardHost>` so it can read the
 * card context via `useObjectClick`. Memory-star clicks resolve to a memory card; a
 * gateway dive would route through `diveTo` (the real-object layer adopts this hook
 * when slice I / #112 lands). Hover/focus (#154) reports up through `onHoverChange`;
 * `litIds` flows back down as the dim mask while a constellation is lit.
 */
const InteractiveStars = ({
  stars,
  ignitingIds,
  diveTo,
  a11yLabel,
  moodLabels,
  onHoverChange,
  litIds,
}: {
  stars: readonly MemoryStar[];
  ignitingIds: ReadonlySet<string>;
  diveTo: (id: string, tier: Tier) => void;
  a11yLabel: string;
  moodLabels: Messages["moods"];
  onHoverChange: (star: MemoryStar | null) => void;
  litIds: ReadonlySet<string> | null;
}) => {
  const onSelect = useObjectClick(diveTo);
  return (
    <MemoryStarLayer
      stars={stars}
      ignitingIds={ignitingIds}
      onSelect={onSelect}
      a11yLabel={a11yLabel}
      moodLabels={moodLabels}
      onHoverChange={onHoverChange}
      litIds={litIds}
    />
  );
};

/**
 * The Local-Group titles made interactive (#169) — a child of `<CardHost>` so it
 * can read the card context via `useObjectClick`, the SAME seam memory stars use:
 * `resolveClick` sends the MW gateway to `nav.diveTo` (→ the #167 descend
 * timeline, no new camera math) and a neighbour to `openCard` (its lore card).
 *
 * The seam needs the full `RealObject`, but a pure `LgHitTarget` deliberately
 * carries only `{ id, loreKey, … }` (keeping `lg-composition.ts` pure). So the
 * id→object resolution lives here at the wiring layer: each LG hit-target id maps
 * back to its Layer-A `RealObject` — the home Milky Way + the 4 placed
 * neighbours. `hoverAffordanceFor` is the #154 gate: a real object affords the
 * clickable highlight + an effect (the memory branch never reaches this layer).
 */
const LgInteractiveLabels = ({
  diveTo,
  lore,
  onActiveChange,
  onNarrate,
}: {
  diveTo: (id: string, tier: Tier) => void;
  lore: Messages["lore"];
  /** Hover/focus sink (#174): the active galaxy id → the backdrop's point-cloud bloom. */
  onActiveChange: (id: string | null) => void;
  /** Object-focus narration sink (#184): a neighbour's card open → a cached AI fact. */
  onNarrate: (object: { loreKey: string }) => void;
}) => {
  const objectClick = useObjectClick(diveTo);
  const byId = useMemo(() => {
    const home = REAL_OBJECTS.find((o) => o.id === HOME_MILKY_WAY_ID);
    return new Map(
      [...(home ? [home] : []), ...lgGalaxies().map((g) => g.object)].map(
        (o) => [o.id, o] as const,
      ),
    );
  }, []);
  const onSelect = useCallback(
    (id: string) => {
      const real = byId.get(id);
      if (real && hoverAffordanceFor(real).kind === "real") {
        objectClick(real);
        // The MW gateway DIVES (no card); a neighbour OPENS its lore card — exactly
        // when ASTRO should narrate a cached fact about it (#184). Gating on the
        // non-gateway branch keeps narration off the dive (no bubble mid-descent).
        if (real.gateway !== true) onNarrate(real);
      }
    },
    [byId, objectClick, onNarrate],
  );
  return (
    <LgGalaxyLabels
      labels={lgLabels()}
      targets={lgHitTargets()}
      lore={lore}
      onSelect={onSelect}
      onActiveChange={onActiveChange}
    />
  );
};
