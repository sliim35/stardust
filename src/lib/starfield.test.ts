import { describe, expect, it } from "vitest";
import { generateStars, starfieldShadow } from "#/lib/starfield";

describe("generateStars", () => {
  it("is deterministic for a given seed", () => {
    expect(generateStars(42, 64, 1000)).toEqual(generateStars(42, 64, 1000));
  });

  it("produces different skies for different seeds", () => {
    expect(generateStars(1, 64, 1000)).not.toEqual(generateStars(2, 64, 1000));
  });

  it("returns exactly the requested number of stars", () => {
    expect(generateStars(7, 128, 1000)).toHaveLength(128);
  });

  it("keeps every star inside the field and within range", () => {
    for (const s of generateStars(7, 256, 1000)) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1000);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1000);
      expect(s.alpha).toBeGreaterThan(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
      expect([1, 2]).toContain(s.size);
    }
  });
});

describe("starfieldShadow", () => {
  it("emits one shadow per star", () => {
    const stars = generateStars(3, 10, 1000);
    expect(starfieldShadow(stars).split("),").length).toBe(stars.length);
  });

  it("is deterministic given the same stars", () => {
    const stars = generateStars(9, 20, 1000);
    expect(starfieldShadow(stars)).toBe(starfieldShadow(stars));
  });
});
