import { describe, expect, it } from "vitest";
import { backdropTintVars } from "#/lib/galaxy/backdrop-tint";
import { DEFAULT_PALETTE, paletteFor } from "#/lib/galaxy/palette";

/**
 * The full-bleed nebula tint (#76) is lifted out of the L2 canvas into a CSS
 * host. Its colors must come from the *same* palette matrix the disk glow uses
 * (`paletteFor`), so a theme switch re-tints Layer A and L2 together (AC9). This
 * pins that mapping; the gradient geometry/alpha lives in CSS, verified visually.
 */
describe("backdropTintVars", () => {
  it("sources the four tint colors from the palette's haze/core tokens", () => {
    const p = paletteFor("ember");
    expect(backdropTintVars("ember")).toEqual({
      "--tint-haze-near": p.hazeNear,
      "--tint-haze-far": p.hazeFar,
      "--tint-core-warm": p.coreWarm,
      "--tint-core-hot": p.coreHot,
    });
  });

  it("defaults to the approved auroral sky when no palette is given", () => {
    expect(backdropTintVars()).toEqual(backdropTintVars(DEFAULT_PALETTE));
  });

  it("re-tints — a different palette yields different tint vars (AC9)", () => {
    expect(backdropTintVars("ember")).not.toEqual(backdropTintVars("ice"));
  });

  it("exposes exactly the four documented tint custom properties", () => {
    expect(Object.keys(backdropTintVars("auroral")).sort()).toEqual([
      "--tint-core-hot",
      "--tint-core-warm",
      "--tint-haze-far",
      "--tint-haze-near",
    ]);
  });
});
