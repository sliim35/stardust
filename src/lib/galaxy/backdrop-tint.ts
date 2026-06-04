/**
 * The full-bleed nebula tint (#76). The haze + core radial washes that used to
 * paint as full-rect `fillRect(0,0,STAGE_W,STAGE_H)` fills inside the confined
 * 1280×800 L2 canvas — whose rectangular edge was the visible seam — now live in
 * a viewport-sized CSS host (`BackdropTint` → `.galaxy-backdrop-tint`).
 *
 * This module owns only the *color* mapping: the four tint custom properties,
 * read straight from the active palette's `hazeNear/hazeFar/coreWarm/coreHot`
 * tokens (the same matrix the L2 disk glow uses), so a theme switch re-tints the
 * full-bleed tint and the disk together (AC9). The gradient geometry, anchor
 * (`50% 50%` — the viewport-center the contain-fit stage maps the bulge core to;
 * NOT 38%, which offset the wash above the bulge into a second "sun"), and alpha
 * curve are CSS in `.galaxy-backdrop-tint` — verified by screenshot, not unit-tested.
 */

import { paletteFor } from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";

/** The CSS custom properties the `.galaxy-backdrop-tint` gradients consume. */
export type BackdropTintVars = {
  "--tint-haze-near": string;
  "--tint-haze-far": string;
  "--tint-core-warm": string;
  "--tint-core-hot": string;
};

/** Map a palette to its full-bleed tint custom properties (defaults to auroral). */
export const backdropTintVars = (palette?: Palette): BackdropTintVars => {
  const p = paletteFor(palette);
  return {
    "--tint-haze-near": p.hazeNear,
    "--tint-haze-far": p.hazeFar,
    "--tint-core-warm": p.coreWarm,
    "--tint-core-hot": p.coreHot,
  };
};
