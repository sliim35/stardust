import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createFocusController } from "#/lib/galaxy/focus";
import { paletteAccentVars } from "#/lib/galaxy/palette";
import { HOME_GALAXY_ID } from "#/lib/galaxy/scenegraph";
import { createInMemoryStore } from "#/lib/galaxy/store";
import { BackdropTint } from "./BackdropTint";
import { ChromeOverlay } from "./ChromeOverlay";
import { DeepStarfield } from "./DeepStarfield";
import { GalaxyBackdrop } from "./GalaxyBackdrop";
import { GalaxyFeatureLayer } from "./GalaxyFeatureLayer";
import { MemoryStarLayer } from "./MemoryStarLayer";
import { useGalaxyCamera } from "./useGalaxyCamera";
import { usePalette } from "./usePalette";
import { useStageFit } from "./useStageFit";

/** Mirrors the `memIgnite` CSS animation duration (1.5s) — one ignite number. */
const IGNITE_MS = 1500;

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

  const scale = useStageFit();
  // The focus-by-id seam (#111): a stable controller other features (#5 deep-link,
  // #113 search) call to ease the camera onto a star by id. The camera hook
  // resolves the id against the live sky (`skyRef`) and drives the eased move.
  const [focus] = useState(() => createFocusController());
  const cam = useGalaxyCamera({ focus, getSky: () => skyRef.current });

  return (
    <div
      className="galaxy-stage"
      ref={cam.stage}
      // Publish the active accent onto the shared @theme vars so chrome utilities
      // (text-accent, border-accent, focus rings) re-tint with the picked sky.
      style={paletteAccentVars(palette) as CSSProperties}
      onPointerMove={cam.onPointerMove}
      onPointerLeave={cam.onPointerLeave}
    >
      {/* Layer A — full-bleed space: nebula tint + L1 starfield (carries cam.l1,
          the farthest/slowest parallax plane). Decorative. */}
      <div className="galaxy-space" ref={cam.l1} aria-hidden="true">
        <BackdropTint palette={palette} />
        <DeepStarfield />
      </div>
      {/* Layer B — the contain-fit stage (UNCHANGED): disk glow (L2, transparent)
          + memory stars (L3), scaled by --stage-scale and centered. */}
      <div
        className="galaxy-stage__fit"
        ref={cam.fit}
        style={{ "--stage-scale": scale } as CSSProperties}
      >
        <div className="galaxy-stage__camera" ref={cam.cam}>
          <div className="galaxy-l2-wrap" ref={cam.l2}>
            <GalaxyBackdrop backdrop={backdrop} />
            {/* Layer A·features — real objects drawn by shape over the disk glow:
                Sgr A*, the Orion Arm, Sol, and the 3 named nebulae (ADR-0010 §4,
                #146). Rides with the disk plane so it parallaxes with the cosmos. */}
            <GalaxyFeatureLayer />
          </div>
          <div className="galaxy-l3-wrap" ref={cam.l3}>
            <MemoryStarLayer stars={sky.stars} ignitingIds={ignitingIds} />
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
      />
    </div>
  );
};
