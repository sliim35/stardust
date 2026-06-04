import type { Palette } from "#/lib/galaxy/types";
import { Astro } from "./Astro";
import { GalaxyChrome } from "./GalaxyChrome";
import { PaletteSwitcher } from "./PaletteSwitcher";

type Props = {
  count: number;
  palette: Palette;
  onPaletteChange: (p: Palette) => void;
};

/**
 * Layer C — the viewport-fixed chrome overlay (#76). Groups the title/breadcrumb/
 * live count (`GalaxyChrome`), the ASTRO mascot, and the `PaletteSwitcher` into
 * one `.galaxy-chrome-overlay` (`position:fixed; inset:0`) pinned to the viewport
 * at fixed px, so they hold a readable size at any width instead of scaling with
 * the stage (the #67 fix). The overlay is `pointer-events:none` so it never blocks
 * star hovers; the palette dots re-enable pointer-events for themselves. ASTRO
 * lives here too so the mascot stays a fixed-size corner host like the title,
 * rather than shrinking with the stage (#70 placed it inside the fit).
 *
 * A sibling of `BackdropTint` (Layer A): each layer is its own component, so
 * `GalaxyStage` composes the scene from named layers rather than inline wrappers.
 */
export const ChromeOverlay = ({ count, palette, onPaletteChange }: Props) => (
  <div className="galaxy-chrome-overlay">
    <GalaxyChrome count={count} />
    <Astro />
    <PaletteSwitcher value={palette} onChange={onPaletteChange} />
  </div>
);
