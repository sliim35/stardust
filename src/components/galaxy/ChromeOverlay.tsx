import { Astro } from "./Astro";
import { GalaxyChrome } from "./GalaxyChrome";

type Props = {
  count: number;
};

/**
 * Layer C — the viewport-fixed chrome overlay (#76). Groups the title/breadcrumb/
 * live count (`GalaxyChrome`) and the ASTRO mascot into one `.galaxy-chrome-overlay`
 * (`position:fixed; inset:0`) pinned to the viewport at fixed px, so they hold a
 * readable size at any width instead of scaling with the stage (the #67 fix). The
 * overlay is `pointer-events:none` so it never blocks star hovers. ASTRO lives here
 * too so the mascot stays a fixed-size corner host like the title, rather than
 * shrinking with the stage (#70 placed it inside the fit).
 *
 * The backdrop theme dots (`PaletteSwitcher`) were dropped from the HD-2D main view
 * (owner critique #4): three swatches under the breadcrumb mixed alt-accent threads
 * (rose · amber · grey) on one surface, read as nothing, and competed with the
 * breadcrumb. The picker component + `usePalette` persistence stay in the tree for a
 * future, clearer affordance; the sky still renders the persisted/default palette.
 *
 * A sibling of `BackdropTint` (Layer A): each layer is its own component, so
 * `GalaxyStage` composes the scene from named layers rather than inline wrappers.
 */
export const ChromeOverlay = ({ count }: Props) => (
  <div className="galaxy-chrome-overlay">
    <GalaxyChrome count={count} />
    <Astro />
  </div>
);
