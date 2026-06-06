import { describe, expect, it } from "vitest";
import {
  formatRingLabel,
  type Ring,
  ringsForTier,
} from "#/lib/galaxy/scale-net";

describe("ringsForTier — the tier-aware scale net model (spec §5.3)", () => {
  it("Local-Group tier labels the LG range: 200k ly · 1 Mly · 2.5 Mly", () => {
    const rings = ringsForTier("localGroup");
    expect(rings.map(formatRingLabel)).toEqual(["200k ly", "1 Mly", "2.5 Mly"]);
  });

  it("Milky-Way (galaxy) tier labels the disk scale: 10k ly · 50k ly · 100k ly", () => {
    const rings = ringsForTier("galaxy");
    expect(rings.map(formatRingLabel)).toEqual(["10k ly", "50k ly", "100k ly"]);
  });

  it("returns three rings per built tier (the §5.3 table)", () => {
    expect(ringsForTier("localGroup")).toHaveLength(3);
    expect(ringsForTier("galaxy")).toHaveLength(3);
  });

  it("radii are relative (0..1), strictly increasing outward", () => {
    for (const tier of ["localGroup", "galaxy"] as const) {
      const radii = ringsForTier(tier).map((r) => r.radius);
      for (const r of radii) {
        expect(r).toBeGreaterThan(0);
        expect(r).toBeLessThanOrEqual(1);
      }
      // strictly increasing — outer rings read as farther
      for (let i = 1; i < radii.length; i++) {
        expect(radii[i]).toBeGreaterThan(radii[i - 1]);
      }
    }
  });

  it("the outermost ring is the full radius (1) — the net's edge", () => {
    for (const tier of ["localGroup", "galaxy"] as const) {
      const rings = ringsForTier(tier);
      expect(rings.at(-1)?.radius).toBe(1);
    }
  });

  it("Solar-System tier is deferred (#127) — returns no rings, no crash", () => {
    // The tier exists in the union but is not built in v1; the net must degrade
    // gracefully rather than throw (the visitor never reaches it).
    expect(ringsForTier("solarSystem")).toEqual([]);
  });

  it("is a pure function — same tier yields equal label/distance data each call", () => {
    const a = ringsForTier("localGroup");
    const b = ringsForTier("localGroup");
    expect(a.map(formatRingLabel)).toEqual(b.map(formatRingLabel));
    expect(a.map((r) => r.radius)).toEqual(b.map((r) => r.radius));
  });
});

describe("formatRingLabel — authored real-distance → display label", () => {
  it("renders kilo magnitudes with a k suffix and the unit", () => {
    expect(formatRingLabel({ radius: 0.5, value: 10000, unit: "ly" })).toBe(
      "10k ly",
    );
    expect(formatRingLabel({ radius: 0.5, value: 200000, unit: "ly" })).toBe(
      "200k ly",
    );
  });

  it("renders sub-kilo and round magnitudes verbatim", () => {
    expect(formatRingLabel({ radius: 1, value: 1, unit: "Mly" })).toBe("1 Mly");
    expect(formatRingLabel({ radius: 1, value: 2.5, unit: "Mly" })).toBe(
      "2.5 Mly",
    );
  });

  it("keeps exactly the whole number when the value is round (no trailing .0)", () => {
    expect(formatRingLabel({ radius: 1, value: 100000, unit: "ly" })).toBe(
      "100k ly",
    );
  });
});

describe("Ring type — carries the real distance for the label", () => {
  it("each ring exposes radius + value + unit", () => {
    const ring: Ring = ringsForTier("galaxy")[0];
    expect(ring).toHaveProperty("radius");
    expect(ring).toHaveProperty("value");
    expect(ring).toHaveProperty("unit");
  });
});
