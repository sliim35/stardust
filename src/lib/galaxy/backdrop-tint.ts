/**
 * The full-bleed nebula tint (#76). The haze radial washes that used to paint as
 * full-rect `fillRect(0,0,STAGE_W,STAGE_H)` fills inside the confined 1280×800 L2
 * canvas — whose rectangular edge was the visible seam — now live in a
 * viewport-sized CSS host (`BackdropTint` → `.backdrop-tint-gradient`).
 *
 * #137 removed the central core radial wash. It was pinned to viewport-center
 * (`50% 50%`), so it floated disconnected from the disk once you pan/zoom (the
 * tint host is full-viewport, not part of the camera-transformed stage). The
 * bright centre now comes solely from the L2 bulge point-cloud (`backdrop.ts`
 * `bulge`), which moves WITH the camera. Only the `--tint-core-*` CSS wash is
 * gone — the `coreWarm/coreHot` *palette* tokens stay (the L2 disk glow + brand
 * composer still read them).
 *
 * This module owns only the *color* mapping: the two haze tint custom properties,
 * read straight from the active palette's `hazeNear/hazeFar` tokens (the same
 * matrix the L2 disk glow uses), so a theme switch re-tints the full-bleed tint
 * and the disk together (AC9). The gradient geometry, anchor (`50% 50%`), and
 * alpha curve are CSS in `.backdrop-tint-gradient` — verified by screenshot, not
 * unit-tested.
 */

import { paletteFor } from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";

/** The CSS custom properties the `.backdrop-tint-gradient` haze washes consume. */
export type BackdropTintVars = {
  "--tint-haze-near": string;
  "--tint-haze-far": string;
};

/** Map a palette to its full-bleed haze tint custom properties (defaults to auroral). */
export const backdropTintVars = (palette?: Palette): BackdropTintVars => {
  const p = paletteFor(palette);
  return {
    "--tint-haze-near": p.hazeNear,
    "--tint-haze-far": p.hazeFar,
  };
};
