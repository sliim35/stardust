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
 */
export const BackdropTint = ({ palette }: { palette?: Palette }) => (
  <div
    className="galaxy-backdrop-tint"
    aria-hidden="true"
    style={backdropTintVars(palette) as CSSProperties}
  />
);
