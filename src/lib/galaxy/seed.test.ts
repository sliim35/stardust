import { describe, expect, it } from "vitest";
import { buildSeedSky, MOODS, placeStar } from "#/lib/galaxy/seed";

describe("buildSeedSky", () => {
  it("seeds a backdrop and at least 3 stars spanning at least 2 moods", () => {
    const sky = buildSeedSky();
    expect(sky.backdrop).toBeDefined();
    expect(sky.stars.length).toBeGreaterThanOrEqual(3);
    expect(new Set(sky.stars.map((s) => s.mood)).size).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("defaults the backdrop palette to auroral", () => {
    expect(buildSeedSky().backdrop.palette).toBe("auroral");
  });

  it("is deterministic — no module-scope random or clock (same output every call)", () => {
    expect(buildSeedSky()).toEqual(buildSeedSky());
  });

  it("uses fixed backdated createdAt (no Date.now at seed time)", () => {
    expect(buildSeedSky().stars.map((s) => s.createdAt)).toEqual(
      buildSeedSky().stars.map((s) => s.createdAt),
    );
  });

  it("includes the quiet egg star and the deep 'fly-home' star", () => {
    const stars = buildSeedSky().stars;
    expect(stars.some((s) => s.egg === true)).toBe(true);
    expect(stars.some((s) => s.deep === true)).toBe(true);
  });

  it("colors seed memory stars from the mood map (agent palette)", () => {
    for (const s of buildSeedSky().stars) {
      if (s.egg || s.deep) continue;
      expect(s.color).toBe(MOODS[s.mood].color);
    }
  });

  it("keeps every star within valid ranges", () => {
    for (const s of buildSeedSky().stars) {
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.r).toBeGreaterThanOrEqual(0);
      expect(s.r).toBeLessThanOrEqual(1);
      expect(Number.isFinite(s.angle)).toBe(true);
      expect(s.brightness).toBeGreaterThanOrEqual(0);
      expect(s.brightness).toBeLessThanOrEqual(1);
    }
  });
});

describe("placeStar", () => {
  it("derives (r, angle) deterministically from the id", () => {
    expect(placeStar("s01", "joyful")).toEqual(placeStar("s01", "joyful"));
  });

  it("places different ids at different positions", () => {
    expect(placeStar("s01", "joyful")).not.toEqual(placeStar("s02", "joyful"));
  });

  it("places a star within its mood's angular wedge, r in 0..1", () => {
    const m = MOODS.peaceful;
    const { r, angle } = placeStar("xyz", "peaceful");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(Math.abs(angle - m.angle)).toBeLessThanOrEqual(m.spread / 2 + 1e-9);
  });
});
