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
  figureMemberIds,
  figuresInSky,
  hoverAffordanceFor,
} from "#/lib/galaxy/constellation";
import { type DeepLinkSearch, resolveDeepLink } from "#/lib/galaxy/deep-link";
import {
  createFocusController,
  DEEPLINK_FRAMING_ZOOM,
} from "#/lib/galaxy/focus";
import {
  enteredObjectFor,
  type PlacedGalaxy,
} from "#/lib/galaxy/galaxy-render";
import { createHighlightController } from "#/lib/galaxy/highlight";
import {
  LG_MW_PLACEMENT,
  lgGalaxies,
  lgGoldAccents,
  lgHitTargets,
  lgLabels,
} from "#/lib/galaxy/lg-composition";
import { paletteAccentVars } from "#/lib/galaxy/palette";
import { DISK_TILT, polarToXY } from "#/lib/galaxy/place";
import {
  HOME_MILKY_WAY_ID,
  REAL_OBJECTS,
  SOL_ID,
  SOL_SYSTEM_ID,
  solarSystemObjects,
} from "#/lib/galaxy/realdata";
import { interiorLayersVisible } from "#/lib/galaxy/scene-visibility";
import { HOME_GALAXY_ID, starsForView } from "#/lib/galaxy/scenegraph";
import { createInMemoryStore } from "#/lib/galaxy/store";
import { createD1Store } from "#/lib/galaxy/store-d1";
import { availableTiersFor, HOME_TIER } from "#/lib/galaxy/tier-nav";
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
import { SolarSystemLayer } from "./SolarSystemLayer";
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

/**
 * How long the deep-link arrival highlight ring holds before clearing (ADR-0018 §3).
 * Owner-tunable knob (show variants at QA): ~2.4s default, matching the `IGNITE_MS`
 * family feel. Reduced-motion variant is a static ring that holds then fades — the
 * same duration clears it either way.
 */
const HIGHLIGHT_MS = 2400;

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
  // Stable reference to store.getSky so the camera + solar-star memo + deep-link
  // effect can read ALL tiers (including solarSystem Mom) without Biome dep warnings.
  const storGetSky = store.getSky;
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
  // The displayed galaxy's interior tilt, mirrored into a ref so a focus request
  // (resolved live in the camera hook) targets the SAME tilt the star renders at (#234).
  const displayTiltRef = useRef(DISK_TILT);
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
        // Deep-link arrival: focus at the in-context zoom (not the default 1.8
        // close-up) and set the highlight cue (ADR-0018 §3).
        focus.focusStar(pendingStar, DEEPLINK_FRAMING_ZOOM);
        highlight.highlight(pendingStar);
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

  // Deep-link highlight seam (ADR-0018 §3): which star (if any) is temporarily
  // highlighted after a deep-link arrival. The clear timer is component-side,
  // mirroring the ignite pattern above.
  const [highlight] = useState(() => createHighlightController());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Highlight subscription: drive `highlightedId` state from the pure controller
  // seam. The clear timer is owned here (component-side, like the ignite timers).
  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    const off = highlight.subscribe((req) => {
      if (clearTimer !== null) clearTimeout(clearTimer);
      if (req.kind === "highlight") {
        setHighlightedId(req.id);
        // Route the auto-clear back through the controller so the single
        // `clear` path (this handler's else-branch) owns the state mutation.
        clearTimer = setTimeout(() => highlight.clear(), HIGHLIGHT_MS);
      } else {
        setHighlightedId(null);
      }
    });
    return () => {
      off();
      if (clearTimer !== null) clearTimeout(clearTimer);
    };
  }, [highlight]);

  const cam = useGalaxyCamera({
    focus,
    // Use all stars (including solar-tier) for camera focus resolution — the galaxy-tier
    // sky (skyRef.current) excludes Mom (irina) after her move to the Solar System.
    getSky: storGetSky,
    getDisplayTilt: () => displayTiltRef.current,
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
  // The focused galaxy's BUILT tier set (BR22 / ADR-0016 §4, #248): threaded into
  // the object-click seam so a Sol click at the Milky-Way tier resolves to a DIVE
  // into the Solar System (the home set includes solarSystem); a neighbour's set
  // excludes it, so the same seam stays a galaxy-floor dive there. `'home'` is the
  // fallback at the LG overview, mirroring the reducer + the chrome breadcrumb.
  const available = useMemo(
    () => availableTiersFor(navGalaxyId ?? "home"),
    [navGalaxyId],
  );
  const onTierSelect = useCallback(
    (target: Tier) => {
      if (target === "localGroup") ascend();
      else if (target === "galaxy")
        diveTo(navGalaxyId ?? HOME_MILKY_WAY_ID, "galaxy");
      // The SOL crumb is navigable above tier 3 (ADR-0016 §4, #248): it dives INTO
      // the Solar System through the same gateway dive a Sol click takes. Only the
      // home MW owns this tier, so the dive id is always Sol.
      else if (target === "solarSystem") diveTo(SOL_ID, "solarSystem");
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
      // Use getSky() (all tiers) so a solar-tier star like Mom (irina) is findable.
      // skyRef.current is scoped to the galaxy tier and excludes solarSystem stars.
      findStar: (id) => storGetSky().stars.find((s) => s.id === id),
      // The home galaxy's set includes solarSystem (ADR-0016 §4, #248), so a
      // `?at=system:sol` link can reach tier 3; the v1 default could not. A
      // neighbour-scoped link still resolves against its own set inside the
      // resolver (graceful — no solarSystem for a neighbour).
      available: availableTiersFor("home"),
    });
    if (!target) return;
    if (target.dive.tier !== nav.state.tier) {
      pendingDeepLinkStar.current = target.star;
      nav.diveTo(target.dive.id, target.dive.tier);
    } else if (target.star) {
      // Same-tier deep-link: focus at in-context zoom + highlight (ADR-0018 §3).
      focus.focusStar(target.star, DEEPLINK_FRAMING_ZOOM);
      highlight.highlight(target.star);
    }
  }, [deepLink, nav, focus, highlight, storGetSky]);

  // The scene swap (#125 → composed by I-2 #112): at the Local-Group tier the
  // disk paints the FINAL-proof composition — the MW shrunk (LG_MW_PLACEMENT) +
  // the 3 neighbours spread per `lg-composition` + the gold accents — and the
  // L3 memory layer (MW-interior content) hides below. Memoized so the canvas
  // only redraws when the displayed tier actually swaps.
  const lgView = displayedTier === "localGroup";
  // The Solar-System tier (ADR-0016 §3): the deepest dive floor — Sol + the 8
  // planets, the quiet void. Layer A only; the L3 memory layer hides (BR33, §6).
  const solarView = displayedTier === "solarSystem";
  // The home Milky Way interior is represented TWO ways: `null` (a wheel-descend
  // from the LG leaves galaxyId unset) OR HOME_MILKY_WAY_ID (the gateway-click dive
  // sets it). Both mean "inside the home MW" — the same rule `entryNarration` uses —
  // so the Sol gateway (#262) renders in BOTH entry paths, not just the wheel one.
  const inHomeMilkyWay =
    !lgView &&
    !solarView &&
    (displayedGalaxyId === null || displayedGalaxyId === HOME_MILKY_WAY_ID);
  const neighbours = useMemo(
    () => (lgView ? lgGalaxies() : NO_NEIGHBOURS),
    [lgView],
  );
  const goldDust = useMemo(
    () => (lgView ? lgGoldAccents() : NO_GOLD),
    [lgView],
  );
  // The tier-3 body set the backdrop paints (Sol + 8 planets); null off-tier so
  // every other view keeps its disk render unchanged.
  const solarSystem = useMemo(
    () => (solarView ? solarSystemObjects() : null),
    [solarView],
  );
  // The entered (tier-2) galaxy whose OWN morphology the backdrop must paint (#226):
  // a non-home neighbour at the galaxy tier; null at the LG overview or home MW (the
  // untouched grand-spiral path). The disk swaps to its real shape, not the MW twin.
  const enteredObject = useMemo(
    () => (lgView ? null : enteredObjectFor(displayedGalaxyId)),
    [lgView, displayedGalaxyId],
  );
  // Stars + figures project at the displayed galaxy's own disk tilt (the same
  // `enteredObject` the disk is painted from, #226) so they sit on it, not the global
  // 0.74 — else the tilted neighbours render off-screen / squashed (#234).
  const displayTilt = enteredObject?.tilt ?? DISK_TILT;
  displayTiltRef.current = displayTilt;

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

  // Emotion figures (owner Claude Design 2026-06-22) are AMBIENT, not hover-revealed:
  // every authored figure with ≥2 members in the sky is always present in its host sky —
  // a dashed ghost silhouette + hollow open-slot rings while forming, igniting to the
  // solid figure at its threshold. Members render as real jewels ON their anchors (the
  // star layer draws them — placed on-anchor at write/seed time). `constellation.ts`
  // owns the rules. Gated off the Local-Group view (I-2): L3 hides there.
  const figures = useMemo(
    () => (lgView || solarView ? [] : figuresInSky(sky.stars, displayTilt)),
    [lgView, solarView, sky.stars, displayTilt],
  );
  // The L4 foreground figure plane (#243): partition the sky once into the stars that
  // belong to a renderable figure (the members — promoted to L4 with their overlay) and
  // the loose stars (free — stay on L3). `figureMemberIds` mirrors `figuresInSky`'s own
  // validation, so a member is on L4 iff its figure draws; deep/cross-mood/lone-group
  // stars (ADR-0014) fall to `freeStars`. The split is pure → SSR markup is deterministic
  // and the connect-lines stay locked to their jewels at rest (RAF off → both planes at
  // translate 0). Tilt-independent (membership is geometry-free), so it doesn't recompute
  // on a neighbour's foreshortening change.
  // Three-way split (#243 + owner follow-up 2026-06-24): Mom's singular `deep` star
  // (ADR-0010 §1) is now in the Solar System (owner 2026-06-25) — she never appears
  // in the MW interior layers (L3/L4/L5). The split only iterates GALAXY-TIER stars so
  // Mom's solarSystem placement excludes her from deepStars here. Figure members ride
  // L4 with their overlay; the loose stars stay on L3. Pure → SSR markup deterministic.
  // `solarStars` is the separate Solar-System memory set (currently only Mom).
  const { deepStars, memberStars, freeStars } = useMemo(() => {
    const memberIds = figureMemberIds(sky.stars);
    const deep: MemoryStar[] = [];
    const members: MemoryStar[] = [];
    const free: MemoryStar[] = [];
    // Only consider galaxy-tier stars for the MW interior planes (L3/L4/L5).
    // Stars with solarSystem placement (e.g. Mom) are handled separately below.
    const galaxyStars = starsForView(sky.stars, "galaxy", HOME_GALAXY_ID);
    for (const star of galaxyStars) {
      if (star.deep) deep.push(star);
      else if (memberIds.has(star.id)) members.push(star);
      else free.push(star);
    }
    return { deepStars: deep, memberStars: members, freeStars: free };
  }, [sky.stars]);
  // Solar-System memory stars (owner 2026-06-25): Mom's dedication star now lives here.
  // Computed from getSky() (ALL tiers) because sky.stars is scoped to galaxy-tier
  // stars only (skyFor/filterStarsForView), which excludes Mom's solarSystem placement.
  // `sky` is intentional: it's the reactive trigger for re-computation when store
  // changes — even though the actual read goes through storGetSky() (all-tiers).
  // biome-ignore lint/correctness/useExhaustiveDependencies: sky is a reactive trigger
  const solarStars = useMemo(
    () => starsForView(storGetSky().stars, "solarSystem", SOL_SYSTEM_ID),
    [sky, storGetSky],
  );
  // The far layers keep the reduced-motion-safe opacity transition; ambient figures
  // don't dim the sky (the old hover-reveal dim is retired with the redesign).
  const dimClass =
    "transition-opacity duration-300 motion-reduce:transition-none";

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
          className={`absolute inset-0 will-change-transform ${dimClass}`}
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
            <div
              className={`galaxy-l2-wrap absolute inset-0 will-change-transform ${dimClass}`}
              ref={cam.l2}
            >
              <GalaxyBackdrop
                backdrop={backdrop}
                homePlacement={lgView ? LG_MW_PLACEMENT : MW_PLACEMENT}
                enteredObject={enteredObject}
                neighbours={neighbours}
                goldDust={goldDust}
                highlight={lgHighlight}
                solarSystem={solarSystem}
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
                  available={available}
                  lore={m.lore}
                  onActiveChange={setLgHovered}
                  onNarrate={onNarrate}
                />
              )}
              {/* Sol gateway marker (#262): the clickable sun-bloom that dives into
                  the Solar System from the MW interior. Rides L2 — the MILKY WAY DISK
                  plane (with GalaxyBackdrop) — so it scales + parallaxes WITH the disk
                  (Sol is a real MW star, NOT memory-star content; owner: "on the Milky
                  Way layer, not the stars layer"). HOME MW + galaxy tier only. The
                  marker's outer div is pointer-events-none with only its button opting
                  in; the planes above (L3/L4/L5, all pointer-events-none) pass the
                  click down to it. */}
              {inHomeMilkyWay && (
                <SolGatewayMarker
                  diveTo={nav.diveTo}
                  available={available}
                  lore={m.lore}
                  tilt={displayTilt}
                />
              )}
              {/* S2+S3: HD-2D planet spheres + pulsing Sol + orbital motion (#266).
                  Layered OVER the canvas (which draws the ring ladder + void field)
                  but inside L2 so it moves with the camera. Pointer-events-none on the
                  wrapper; each planet button opts back in (the L4 plane pattern).
                  Only mounts at the solarSystem tier so every other tier is untouched. */}
              {solarView && solarSystem && (
                <SolarSystemLayer
                  bodies={solarSystem}
                  ariaLabelFor={(id) => {
                    const lk = solarSystem.find((o) => o.id === id)?.loreKey;
                    return lk ? (m.lore[lk]?.name ?? id) : id;
                  }}
                  onNarrate={onNarrate}
                />
              )}
              {/* Mom's dedication star in the Solar System (owner 2026-06-25): a
                  singular gold deep-star rendered alongside the planets at the solar
                  tier. Pointer-events-none wrapper; the mem-star button opts back in
                  (the L4 plane pattern — same as SolarSystemLayer). Uses the same
                  InteractiveStars seam as the MW interior so Mom's card + ignite +
                  highlight behaviors are unchanged. Tilt is ignored at tier 3 (no
                  disk foreshortening — the solar view is face-on), so we pass 0. */}
              {solarView && solarStars.length > 0 && (
                <div className="pointer-events-none absolute inset-0">
                  <InteractiveStars
                    stars={solarStars}
                    ignitingIds={ignitingIds}
                    highlightedId={highlightedId}
                    diveTo={nav.diveTo}
                    available={available}
                    a11yLabel={m.a11y.memoryStar}
                    moodLabels={m.moods}
                    tilt={0}
                  />
                </div>
              )}
            </div>
            {/* The L3 memory layer is MW-interior content: at the Local-Group
                tier it hides at the threshold (motion-reduce snaps). ADR-0018 §2:
                visibility is driven by `interiorLayersVisible(displayedTier)` —
                a single source of truth keyed to the GSAP threshold commit, not
                an independent 500ms CSS clock. On ASCEND the layers hide instantly
                (hide-old-before-new eliminates the MW-star flash); on DESCEND the
                `mem-star-enter` fade-in still applies. `pointer-events` guards the
                gap between hide commit and browser paint. */}
            <div
              className={`galaxy-l3-wrap pointer-events-none absolute inset-0 will-change-transform motion-reduce:transition-none ${
                interiorLayersVisible(displayedTier)
                  ? ""
                  : "invisible opacity-0"
              }`}
              ref={cam.l3}
            >
              <InteractiveStars
                stars={freeStars}
                ignitingIds={ignitingIds}
                highlightedId={highlightedId}
                diveTo={nav.diveTo}
                available={available}
                a11yLabel={m.a11y.memoryStar}
                moodLabels={m.moods}
                tilt={displayTilt}
              />
            </div>
            {/* L4 — the foreground figure plane (#243): the emotion figures + their
                member stars, promoted to a near depth tier so they float above the
                loose stars + the disk. ALWAYS `pointer-events-none` (the member
                stars opt back in via `.mem-star`). ADR-0018 §2: same threshold-
                synced visibility as L3 — instant hide on ascend, no independent
                CSS clock. */}
            <div
              className={`pointer-events-none galaxy-l4-wrap absolute inset-0 will-change-transform motion-reduce:transition-none ${
                interiorLayersVisible(displayedTier)
                  ? ""
                  : "invisible opacity-0"
              }`}
              ref={cam.l4}
            >
              {figures.map((f) => (
                <ConstellationOverlay
                  key={f.group}
                  color={f.color}
                  ghost={f.ghost}
                  realSegments={f.realSegments}
                  openSlots={f.openSlots}
                />
              ))}
              <InteractiveStars
                stars={memberStars}
                ignitingIds={ignitingIds}
                highlightedId={highlightedId}
                diveTo={nav.diveTo}
                available={available}
                a11yLabel={m.a11y.memoryStar}
                moodLabels={m.moods}
                tilt={displayTilt}
              />
            </div>
            {/* L5 — the dedication plane (#243 follow-up, owner 2026-06-24): Mom's
                singular gold `deep` star (ADR-0010 §1) rides this nearest plane ALONE.
                ADR-0018 §2: same threshold-synced visibility as L3/L4. */}
            <div
              className={`pointer-events-none galaxy-l5-wrap absolute inset-0 will-change-transform motion-reduce:transition-none ${
                interiorLayersVisible(displayedTier)
                  ? ""
                  : "invisible opacity-0"
              }`}
              ref={cam.l5}
            >
              <InteractiveStars
                stars={deepStars}
                ignitingIds={ignitingIds}
                highlightedId={highlightedId}
                diveTo={nav.diveTo}
                available={available}
                a11yLabel={m.a11y.memoryStar}
                moodLabels={m.moods}
                tilt={displayTilt}
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
          canAddStar={!lgView && !solarView}
        />
        {/* Discovery search (#113) — a viewport-fixed chrome panel that finds a
            memory star by text/mood/colour and frames it via the focus-on-star
            primitive (#111). Lives only at the Milky-Way tier: memory stars are
            MW-interior content (the L3 layer hides on the Local-Group overview),
            so the index is meaningless there. Selecting a result eases the camera
            onto the star — the same primitive the deep-link path uses. */}
        {!lgView && !solarView && (
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
 * `highlightedId` (ADR-0018 §3) marks the deep-link arrival target.
 */
const InteractiveStars = ({
  stars,
  ignitingIds,
  highlightedId,
  diveTo,
  available,
  a11yLabel,
  moodLabels,
  tilt,
}: {
  stars: readonly MemoryStar[];
  ignitingIds: ReadonlySet<string>;
  /** ADR-0018 §3: the id of the deep-link highlighted star, or null. */
  highlightedId?: string | null;
  diveTo: (id: string, tier: Tier) => void;
  /** The focused galaxy's built tier set (#248): keeps the object-click seam on the
   *  galaxy-tier layer ready to dive a gateway (Sol) into its child tier. A memory
   *  star is never a gateway, so this is inert for the stars themselves. */
  available: readonly Tier[];
  a11yLabel: string;
  moodLabels: Messages["moods"];
  /** #234: the displayed galaxy's interior disk tilt, threaded to the star projection. */
  tilt: number;
}) => {
  const onSelect = useObjectClick(diveTo, available);
  return (
    <MemoryStarLayer
      stars={stars}
      ignitingIds={ignitingIds}
      highlightedId={highlightedId}
      onSelect={onSelect}
      a11yLabel={a11yLabel}
      moodLabels={moodLabels}
      tilt={tilt}
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
  available,
  lore,
  onActiveChange,
  onNarrate,
}: {
  diveTo: (id: string, tier: Tier) => void;
  /** The focused galaxy's built tier set (#248), threaded into the gateway-dive seam. */
  available: readonly Tier[];
  lore: Messages["lore"];
  /** Hover/focus sink (#174): the active galaxy id → the backdrop's point-cloud bloom. */
  onActiveChange: (id: string | null) => void;
  /** Object-focus narration sink (#184): a neighbour's card open → a cached AI fact. */
  onNarrate: (object: { loreKey: string }) => void;
}) => {
  const objectClick = useObjectClick(diveTo, available);
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

/**
 * The Sol gateway marker (#262 scope-gap) — the clickable sun-bloom that lets the
 * visitor dive into the Solar System directly from the MW-interior view, without
 * going via the breadcrumb.
 *
 * Visually distinct from Mom's gold memory star (also gold): Sol renders as a
 * REAL-object gateway marker — a larger warm amber bloom with a sun-ray ring glyph
 * and a reveal-on-hover/focus label reading "Sol · her home · one of ~200 billion".
 * Mom's star is a memory-star jewel on the L5 dedication plane; Sol is a real object
 * on the L3 interior plane, sized and colored per the `realdata` spec.
 *
 * Must live inside a `<CardHost>` (reads the card context via `useObjectClick`).
 * Pointer-safe: the outer wrapper is `pointer-events-none`; only the `<button>` opts
 * back in, so the full-bleed marker never swallows clicks on memory stars beneath it.
 *
 * Position: `polarToXY(sol.placement.r=0.5, sol.placement.angle=0.42, tilt)` —
 * the same projection the memory star layer uses, so Sol sits on the MW disk exactly
 * where the realdata places it (#/lib/galaxy/realdata, SOL_ID).
 */
const SolGatewayMarker = ({
  diveTo,
  available,
  lore,
  tilt,
}: {
  diveTo: (id: string, tier: Tier) => void;
  /** The focused galaxy's built tier set (#248) — drives the dive resolution. */
  available: readonly Tier[];
  lore: Messages["lore"];
  /** The displayed galaxy's interior disk tilt (#234) — Sol projects at this angle. */
  tilt: number;
}) => {
  const sol = REAL_OBJECTS.find((o) => o.id === SOL_ID);
  const objectClick = useObjectClick(diveTo, available);
  const [active, setActive] = useState(false);
  if (!sol) return null;
  const { x, y } = polarToXY(sol.placement.r, sol.placement.angle, tilt);
  return (
    // The outer wrapper is pointer-events-none so the full-bleed absolute container
    // never eats clicks on memory stars beneath (the button opts back in below).
    <div data-sol-gateway className="pointer-events-none absolute inset-0">
      {/* The Sol bloom button — pointer-events-auto so ONLY this button is interactive. */}
      <button
        type="button"
        aria-label={`${lore.sol.name} · ${lore.sol.sublabel}`}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f5d6a0]/40"
        style={{
          left: `${Math.round(x)}px`,
          top: `${Math.round(y)}px`,
          // Hit-target: generous 48×48 px so it's comfortably clickable.
          width: "48px",
          height: "48px",
        }}
        onPointerEnter={() => setActive(true)}
        onPointerLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        onClick={() => objectClick(sol)}
      >
        {/* The sun-bloom glyph: a warm gold radial soft-glow ring that reads as
            the Sun / a gateway, distinct from Mom's jewel (a solid filled circle).
            Two concentric circles: outer (the ray ring) + inner (the core). */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          {/* A warm-gold bloom that gently PULSES so it draws the eye on the arm
              (owner: "make it more noticeable") — still a soft glow, NOT a hard ringed
              disk. The `sol-gateway-bloom` class breathes it (motion-reduce: static). */}
          <span
            className="sol-gateway-bloom absolute rounded-full"
            style={{
              width: "26px",
              height: "26px",
              background:
                "radial-gradient(circle, #f5d6a0 0%, #f5d6a066 34%, transparent 72%)",
            }}
          />
          {/* The warm white-gold core — a touch brighter + larger than its neighbours. */}
          <span
            className="absolute rounded-full"
            style={{
              width: "6px",
              height: "6px",
              background: "#fffaf0",
              boxShadow: "0 0 6px 2px #f5d6a0aa",
            }}
          />
        </span>
      </button>
      {/* The reveal label — hover/focus-driven, same pattern as LgGalaxyLabels.
          `data-sol-label` lets the test query it without coupling to class names. */}
      <div
        aria-hidden="true"
        data-sol-label
        className={`pointer-events-none absolute -translate-x-1/2 text-center transition-opacity duration-200 motion-reduce:transition-none ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{
          left: `${Math.round(x)}px`,
          // Label sits BELOW the bloom (owner: it was on the wrong side) — same side
          // as the planet labels, and clear of the arm dust above.
          top: `${Math.round(y) + 20}px`,
          transform: "translateX(-50%)",
        }}
      >
        <em className="block font-serif text-[18px] lowercase italic leading-tight text-[#f5d6a0]">
          {lore.sol.name}
        </em>
        <span className="mt-[3px] block whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.2em] text-[#f5d6a0]/70">
          {lore.sol.sublabel}
        </span>
      </div>
    </div>
  );
};
