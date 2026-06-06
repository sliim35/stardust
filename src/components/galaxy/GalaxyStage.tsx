import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createFocusController } from "#/lib/galaxy/focus";
import { paletteAccentVars } from "#/lib/galaxy/palette";
import { localGroupNeighbours } from "#/lib/galaxy/realdata";
import { HOME_GALAXY_ID } from "#/lib/galaxy/scenegraph";
import { createInMemoryStore } from "#/lib/galaxy/store";
import { HOME_TIER } from "#/lib/galaxy/tier-nav";
import {
  arrivalNarration,
  createTierTransitionController,
  departNarration,
  type TierTransitionEvent,
} from "#/lib/galaxy/tier-transition";
import type { MemoryStar, RealObject, Tier } from "#/lib/galaxy/types";
import { getMessages, useLocale } from "#/lib/i18n";
import { BackdropTint } from "./BackdropTint";
import { CardHost } from "./CardHost";
import { ChromeOverlay } from "./ChromeOverlay";
import { DeepStarfield } from "./DeepStarfield";
import { GalaxyBackdrop } from "./GalaxyBackdrop";
import { MemoryStarLayer } from "./MemoryStarLayer";
import { useGalaxyCamera } from "./useGalaxyCamera";
import { useObjectClick } from "./useObjectClick";
import { usePalette } from "./usePalette";
import { useStageFit } from "./useStageFit";
import { useTierNav } from "./useTierNav";

/** Mirrors the `memIgnite` CSS animation duration (1.5s) — one ignite number. */
const IGNITE_MS = 1500;

/** Stable empty neighbour set — the home/MW scene paints no Layer-A galaxies. */
const NO_NEIGHBOURS: readonly RealObject[] = [];

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
export const GalaxyStage = () => {
  const [store] = useState(() => createInMemoryStore());
  // The home galaxy IS the tier-2 view of the universe's `home` node (ADR-0008 §3):
  // skyFor('home') ≡ getSky() byte-for-byte, so this is render-parity, not a redraw.
  const [sky, setSky] = useState(
    () => store.skyFor?.(HOME_GALAXY_ID) ?? store.getSky(),
  );
  const [ignitingIds, setIgnitingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const skyRef = useRef(sky);
  skyRef.current = sky;

  useEffect(() => {
    // Track the per-star ignite timers so they're cleared on unmount / re-run —
    // otherwise an in-flight timer fires `setIgnitingIds` on an unmounted
    // component and leaks (latent until a live producer in epic #8).
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsubscribe = store.subscribe?.((next) => {
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
  // Layer-A neighbours are NOT rendered at the home/Milky-Way tier (memory-first).
  // The render foundation (placement-aware generator + the `shape`→recipe mappers in
  // galaxy-render.ts + the GalaxyBackdrop `neighbours` capability) is in place and
  // tested; slice I-2 composes the actual Local-Group tier (MW shrunk + the 4
  // neighbours spread + scaled per the FINAL proof) and feeds them to the disk there.
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
  const [narration, setNarration] = useState<string | null>(null);
  const onTransitionEvent = (e: TierTransitionEvent) => {
    if (e.kind === "threshold") setDisplayedTier(e.tier);
    else if (e.kind === "depart")
      setNarration(departNarration(m.astroNarration, e.direction, e.to));
    else setNarration(arrivalNarration(m.astroNarration, e.tier));
  };

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
  const prevTier = useRef(nav.state.tier);
  useEffect(() => {
    const from = prevTier.current;
    const to = nav.state.tier;
    if (from === to) return;
    prevTier.current = to;
    transitions.request(from, to);
  }, [nav.state.tier, transitions]);

  // The scene swap (#125): the Local-Group view paints the 4 real neighbours
  // through the I-1 render capability. Indicative until slice I-2 (#112)
  // composes the full LG scene (MW shrunk + neighbours spread); memoized so the
  // disk only redraws when the displayed tier actually swaps.
  const neighbours = useMemo(
    () =>
      displayedTier === "localGroup" ? localGroupNeighbours() : NO_NEIGHBOURS,
    [displayedTier],
  );
  const a11yLabel = m.a11y.memoryStar;

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
          className="absolute inset-0 [will-change:transform]"
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
            <div className="galaxy-l2-wrap" ref={cam.l2}>
              <GalaxyBackdrop backdrop={backdrop} neighbours={neighbours} />
            </div>
            <div className="galaxy-l3-wrap" ref={cam.l3}>
              <InteractiveStars
                stars={sky.stars}
                ignitingIds={ignitingIds}
                diveTo={nav.diveTo}
                a11yLabel={a11yLabel}
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
          narration={narration}
          onNarrationDismiss={() => setNarration(null)}
        />
      </CardHost>
    </div>
  );
};

/**
 * The L3 memory layer made interactive — a child of `<CardHost>` so it can read the
 * card context via `useObjectClick`. Memory-star clicks resolve to a memory card; a
 * gateway dive would route through `diveTo` (the real-object layer adopts this hook
 * when slice I / #112 lands).
 */
const InteractiveStars = ({
  stars,
  ignitingIds,
  diveTo,
  a11yLabel,
}: {
  stars: readonly MemoryStar[];
  ignitingIds: ReadonlySet<string>;
  diveTo: (id: string, tier: Tier) => void;
  a11yLabel: string;
}) => {
  const onSelect = useObjectClick(diveTo);
  return (
    <MemoryStarLayer
      stars={stars}
      ignitingIds={ignitingIds}
      onSelect={onSelect}
      a11yLabel={a11yLabel}
    />
  );
};
