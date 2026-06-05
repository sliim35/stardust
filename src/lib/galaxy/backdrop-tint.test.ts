import { describe, expect, it } from "vitest";
import { backdropTintVars } from "#/lib/galaxy/backdrop-tint";
import { DEFAULT_PALETTE, paletteFor } from "#/lib/galaxy/palette";

/**
 * The full-bleed nebula tint (#76) is lifted out of the L2 canvas into a CSS
 * host. Its colors must come from the *same* palette matrix the disk glow uses
 * (`paletteFor`), so a theme switch re-tints Layer A and L2 together (AC9). This
 * pins that mapping; the gradient geometry/alpha lives in CSS, verified visually.
 *
 * #137 removed the viewport-fixed core radial wash (the `--tint-core-*` layer):
 * pinned to viewport-center, it floated disconnected from the disk on pan/zoom.
 * Only the haze/nebula tint (`hazeNear`/`hazeFar`) remains; the bright centre now
 * comes solely from the L2 bulge point-cloud, which moves WITH the camera.
 */
describe("backdropTintVars", () => {
  it("sources the two haze tint colors from the palette's haze tokens", () => {
    const p = paletteFor("ember");
    expect(backdropTintVars("ember")).toEqual({
      "--tint-haze-near": p.hazeNear,
      "--tint-haze-far": p.hazeFar,
    });
  });

  it("defaults to the approved auroral sky when no palette is given", () => {
    expect(backdropTintVars()).toEqual(backdropTintVars(DEFAULT_PALETTE));
  });

  it("re-tints — a different palette yields different tint vars (AC9)", () => {
    expect(backdropTintVars("ember")).not.toEqual(backdropTintVars("ice"));
  });

  it("exposes exactly the two documented haze tint custom properties", () => {
    expect(Object.keys(backdropTintVars("auroral")).sort()).toEqual([
      "--tint-haze-far",
      "--tint-haze-near",
    ]);
  });

  it("no longer exposes the removed core-wash tokens (#137)", () => {
    const keys = Object.keys(backdropTintVars("auroral"));
    expect(keys).not.toContain("--tint-core-warm");
    expect(keys).not.toContain("--tint-core-hot");
  });
});
