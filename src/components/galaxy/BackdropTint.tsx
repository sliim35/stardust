import type { CSSProperties } from "react";
import { backdropTintVars } from "#/lib/galaxy/backdrop-tint";
import type { Palette } from "#/lib/galaxy/types";

/**
 * Layer A — the full-bleed nebula tint (#76). The haze + core radial washes that
 * used to paint as full-rect fills inside the confined 1280×800 L2 canvas (their
 * rectangular edge was the visible seam) now render here as full-viewport CSS
 * radial-gradients anchored on the disk center, so space reads as one seamless
 * field top→bottom. Tint colors come from the active palette (`backdropTintVars`
 * → `paletteFor`) so a theme switch re-tints this together with the disk glow
 * (AC9). Decorative: `aria-hidden`, never interactive.
 *
 * #75 boundary (#94): the chrome layout is Tailwind utilities; the 3-stop
 * radial-gradient + `color-mix` is the Tailwind-managed `backdrop-tint-gradient`
 * `@utility` (src/styles.css) — too long to read as an arbitrary `[background:…]`
 * class. It references only the `--tint-*` vars from `backdropTintVars()`, so a
 * palette switch re-tints Layer A together with the disk glow.
 */
export const BackdropTint = ({ palette }: { palette?: Palette }) => (
  <div
    className="absolute inset-0 size-full pointer-events-none backdrop-tint-gradient"
    aria-hidden="true"
    style={backdropTintVars(palette) as CSSProperties}
  />
);
