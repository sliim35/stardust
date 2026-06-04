import { describe, expect, it } from "vitest";
import { CHANNELS, exportSizeFor } from "#/brand/composer/channels";

// AC4 / AC7: per-channel native-res + integer SCALE, integer-scale-only invariant.
describe("CHANNELS", () => {
  it("exposes linkedin, og and avatar channels", () => {
    expect(Object.keys(CHANNELS).sort()).toEqual(["avatar", "linkedin", "og"]);
  });

  it("uses owner-approved defaults for og (200x105 @ 6 = 1200x630, exact)", () => {
    const og = CHANNELS.og;
    expect({ NW: og.NW, NH: og.NH, SCALE: og.SCALE }).toEqual({
      NW: 200,
      NH: 105,
      SCALE: 6,
    });
    // exact multiple — no crop needed
    expect(og.NW * og.SCALE).toBe(og.exportW);
    expect(og.NH * og.SCALE).toBe(og.exportH);
  });

  it("every channel uses an integer SCALE and an integer native grid", () => {
    for (const ch of Object.values(CHANNELS)) {
      expect(Number.isInteger(ch.SCALE)).toBe(true);
      expect(Number.isInteger(ch.NW)).toBe(true);
      expect(Number.isInteger(ch.NH)).toBe(true);
      expect(ch.SCALE).toBeGreaterThanOrEqual(1);
    }
  });

  it("never requires upscaling beyond the integer multiple (crop, never stretch)", () => {
    // The upscaled native canvas must be >= the export size on both axes,
    // so the export is always a CROP of an integer-scaled canvas, never a stretch.
    for (const ch of Object.values(CHANNELS)) {
      expect(ch.NW * ch.SCALE).toBeGreaterThanOrEqual(ch.exportW);
      expect(ch.NH * ch.SCALE).toBeGreaterThanOrEqual(ch.exportH);
    }
  });
});

describe("exportSizeFor", () => {
  it("returns the documented per-channel export sizes (AC7)", () => {
    expect(exportSizeFor("linkedin")).toEqual({ w: 1200, h: 627 });
    expect(exportSizeFor("og")).toEqual({ w: 1200, h: 630 });
    expect(exportSizeFor("avatar")).toEqual({ w: 512, h: 512 });
  });
});
