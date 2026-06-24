import type { MemoryStar, Palette, Tier } from "#/lib/galaxy/types";
import { getMessages, useLocale } from "#/lib/i18n";
import { Astro } from "./Astro";
import { GalaxyChrome } from "./GalaxyChrome";
import { PaletteSwitcher } from "./PaletteSwitcher";
import { ScaleNet } from "./ScaleNet";
import { ZoomHint } from "./ZoomHint";

type Props = {
  count: number;
  palette: Palette;
  onPaletteChange: (p: Palette) => void;
  /**
   * The *displayed* tier — drives both the top-right breadcrumb's active segment
   * and the bottom-left scale net's labels (#112, §5.3). During a tier transition
   * (#125) it swaps at the timeline's threshold, not at request time, so the
   * breadcrumb + net relabel in lockstep, exactly when the scene does.
   */
  tier: Tier;
  /** The live nav galaxy id (BR22, #199) — drives the node-aware breadcrumb. */
  galaxyId?: string | null;
  /** Breadcrumb click → tier navigation (ascend / dive in the stage). */
  onTierSelect?: (tier: Tier) => void;
  /** The active tier-transition narration line for ASTRO's bubble (#125). */
  narration?: string | null;
  /** Clears the narration (bubble dismiss / ASTRO click). */
  onNarrationDismiss?: () => void;
  /** #183 (dir. A) — ignite a saved star; enables ASTRO's "Add your star" CTA. */
  onStarAdded?: (star: MemoryStar) => void;
  /** Show the add-star CTA — true at the Milky-Way tier (#183). */
  canAddStar?: boolean;
};

/**
 * Layer C — the viewport-fixed chrome overlay (#76). Groups the title/breadcrumb/
 * live count (`GalaxyChrome`), the ASTRO mascot, the `PaletteSwitcher`, and the
 * bottom-left tier-aware `ScaleNet` (#112) into one `.galaxy-chrome-overlay`
 * (`position:fixed; inset:0`) pinned to the viewport at fixed px, so they hold a
 * readable size at any width instead of scaling with the stage (the #67 fix). The
 * overlay is `pointer-events:none` so it never blocks star hovers; the palette
 * dots re-enable pointer-events for themselves. ASTRO lives here too so the mascot
 * stays a fixed-size corner host like the title, rather than shrinking with the
 * stage (#70 placed it inside the fit).
 *
 * The scale net is mounted here (not in the camera/render tree) so it pins to the
 * viewport corner and reads the active `tier` — the net relabels per tier (§5.3),
 * decoupled from the parallel renderer work on `GalaxyStage`.
 *
 * A sibling of `BackdropTint` (Layer A): each layer is its own component, so
 * `GalaxyStage` composes the scene from named layers rather than inline wrappers.
 */
export const ChromeOverlay = ({
  count,
  palette,
  onPaletteChange,
  tier,
  galaxyId = null,
  onTierSelect,
  narration = null,
  onNarrationDismiss,
  onStarAdded,
  canAddStar = false,
}: Props) => {
  const m = getMessages(useLocale());
  return (
    <div className="galaxy-chrome-overlay">
      <GalaxyChrome
        count={count}
        tier={tier}
        galaxyId={galaxyId}
        onTierSelect={onTierSelect}
      />
      <Astro
        narration={narration}
        onNarrationDismiss={onNarrationDismiss}
        onStarAdded={onStarAdded}
        canAddStar={canAddStar}
      />
      <PaletteSwitcher value={palette} onChange={onPaletteChange} />
      <ScaleNet tier={tier} label={m.scaleNet.label} />
      {/* The scroll/zoom discoverability hint (#251) — an ambient bottom-centre
          signifier that lives in this pointer-events:none overlay (it never blocks
          the canvas/chrome) and dismisses on the first zoom gesture or a short
          dwell. It self-guards `sessionStorage` so it shows once per session. */}
      <ZoomHint label={m.zoomHint.label} />
    </div>
  );
};
