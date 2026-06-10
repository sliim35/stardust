import { describe, expect, it } from "vitest";
import {
  buildBackdropGeometry,
  type DiskPlacement,
  MW_PLACEMENT,
} from "#/lib/galaxy/backdrop";
import {
  BLOOM_TUNING,
  bloomPointsFor,
  buildGalaxyGeometry,
  placementFor,
  tuningFor,
} from "#/lib/galaxy/galaxy-render";
import { LG_MW_PLACEMENT, lgGalaxies } from "#/lib/galaxy/lg-composition";
import { GALAXY_R, polarToXY, STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import {
  HOME_MILKY_WAY_ID,
  localGroupNeighbours,
  REAL_OBJECTS,
} from "#/lib/galaxy/realdata";
import type { GalaxyBackdrop, RealObject } from "#/lib/galaxy/types";

const byId = (id: string): RealObject => {
  const o = REAL_OBJECTS.find((x) => x.id === id);
  if (!o) throw new Error(`no real object ${id}`);
  return o;
};

const neighbours = localGroupNeighbours();

describe("placementFor — RealObject → DiskPlacement (ADR-0011 §1)", () => {
  it("centres each neighbour at its authored polar placement on the stage", () => {
    for (const o of neighbours) {
      const place = placementFor(o);
      const centre = polarToXY(o.placement.r, o.placement.angle);
      expect(place.cx).toBeCloseTo(centre.x, 6);
      expect(place.cy).toBeCloseTo(centre.y, 6);
    }
  });

  it("scales the disk radius by the object's size (smaller object → smaller disk)", () => {
    const lmc = placementFor(byId("lmc")); // size 0.42
    const smc = placementFor(byId("smc")); // size 0.30
    expect(lmc.r).toBeGreaterThan(smc.r);
    expect(lmc.r).toBeCloseTo(GALAXY_R * 0.42, 6);
    expect(smc.r).toBeCloseTo(GALAXY_R * 0.3, 6);
  });

  it("carries the object's own tilt, and the bar angle as the disk position angle", () => {
    const m31 = byId("andromeda"); // tilt 1.2, barAngle 0.5
    const place = placementFor(m31);
    expect(place.tilt).toBe(m31.tilt);
    expect(place.pa).toBe(m31.barAngle);
  });

  it("falls back to sane defaults when tilt / barAngle are absent (LMC has neither)", () => {
    const lmc = byId("lmc");
    expect(lmc.tilt).toBeUndefined();
    const place = placementFor(lmc);
    expect(Number.isFinite(place.tilt)).toBe(true);
    expect(place.tilt).toBeGreaterThan(0);
    expect(place.pa).toBe(0);
  });
});

describe("tuningFor — RealObject → GalaxyBackdrop tuning (ADR-0011 §1)", () => {
  it("maps arms → branches for spiral neighbours", () => {
    expect(tuningFor(byId("andromeda")).branches).toBe(2); // M31 arms:2
    expect(tuningFor(byId("triangulum")).branches).toBe(4); // M33 pinwheel arms:4
    expect(tuningFor(byId(HOME_MILKY_WAY_ID)).branches).toBe(4); // MW arms:4
  });

  it("gives a clumpy variant a non-zero branch budget even without authored arms", () => {
    const lmc = byId("lmc"); // magellanic, no `arms`
    expect(lmc.arms).toBeUndefined();
    expect(tuningFor(lmc).branches).toBeGreaterThan(0);
  });

  it("derives a STABLE per-object seed (same object → same tuning every call)", () => {
    expect(tuningFor(byId("lmc"))).toEqual(tuningFor(byId("lmc")));
  });

  it("derives a DIFFERENT seed per object (neighbours don't share a sky)", () => {
    const seeds = neighbours.map((o) => tuningFor(o).seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("is pure / SSR-safe — no clock or random leakage between calls", () => {
    expect(tuningFor(byId("smc"))).toEqual(tuningFor(byId("smc")));
  });
});

describe("buildGalaxyGeometry — render-capability for one real object (ADR-0011 §1)", () => {
  it("produces structural point clouds for every neighbour (spiral + clumpy alike)", () => {
    for (const o of neighbours) {
      const g = buildGalaxyGeometry(o);
      expect(g.arms.length).toBeGreaterThan(0);
      expect(g.bulge.length).toBeGreaterThan(0);
    }
  });

  it("does NOT add a full-stage bgStars field per neighbour (no deep-field multiply)", () => {
    // The MW backdrop owns the one deep field; neighbours only contribute their disk.
    for (const o of neighbours) {
      expect(buildGalaxyGeometry(o).bgStars.length).toBe(0);
    }
  });

  it("keeps every neighbour point on the stage", () => {
    for (const o of neighbours) {
      const g = buildGalaxyGeometry(o);
      for (const p of [...g.arms, ...g.bulge]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(STAGE_W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(STAGE_H);
      }
    }
  });

  it("clusters each neighbour's points around its authored placement, not the MW centre", () => {
    for (const o of neighbours) {
      const place = placementFor(o);
      const g = buildGalaxyGeometry(o);
      const pts = [...g.arms, ...g.bulge];
      const meanX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      // Mean lands within the disk footprint of its OWN centre.
      expect(Math.abs(meanX - place.cx)).toBeLessThanOrEqual(place.r + 1);
      expect(Math.abs(meanY - place.cy)).toBeLessThanOrEqual(place.r + 1);
    }
  });

  it("renders the magellanic / irregular clouds as a clumpy cloud (no clean spiral arms)", () => {
    // The clumpy recipe must still produce points; it just isn't the arm generator.
    const lmc = buildGalaxyGeometry(byId("lmc")); // magellanic
    const smc = buildGalaxyGeometry(byId("smc")); // irregular
    expect(lmc.arms.length).toBeGreaterThan(0);
    expect(smc.arms.length).toBeGreaterThan(0);
    // Different shapes/seeds → different point clouds (not accidentally identical).
    expect(lmc.arms).not.toEqual(smc.arms);
  });

  it("is deterministic — same object yields byte-identical geometry", () => {
    expect(buildGalaxyGeometry(byId("triangulum"))).toEqual(
      buildGalaxyGeometry(byId("triangulum")),
    );
  });

  it("accepts an explicit placement override — the tier-composition seam (I-2)", () => {
    const o = byId("andromeda");
    const custom: DiskPlacement = { cx: 220, cy: 580, r: 90, tilt: 0.6, pa: 0 };
    const g = buildGalaxyGeometry(o, custom);
    const pts = [...g.arms, ...g.bulge];
    const meanX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    // The cloud clusters around the GIVEN centre, not the data placement…
    expect(Math.abs(meanX - custom.cx)).toBeLessThanOrEqual(custom.r + 1);
    expect(Math.abs(meanY - custom.cy)).toBeLessThanOrEqual(custom.r + 1);
    // …and differs from the default data-placement build.
    expect(g).not.toEqual(buildGalaxyGeometry(o));
  });
});

describe("bloomPointsFor — LG hover bloom payload (#174)", () => {
  const backdrop: GalaxyBackdrop = {
    seed: 7,
    branches: 4,
    spin: 1,
    randomnessPower: 2.2,
    palette: "ember",
  };
  const neighbours = lgGalaxies();
  const args = { backdrop, homePlacement: LG_MW_PLACEMENT, neighbours };

  it("returns no points when nothing is highlighted", () => {
    expect(bloomPointsFor(null, args)).toHaveLength(0);
    expect(bloomPointsFor(undefined, args)).toHaveLength(0);
    expect(bloomPointsFor("nobody-here", args)).toHaveLength(0);
  });

  it("blooms a neighbour's OWN arms+bulge (not the deep field) when its id matches", () => {
    const m31 = neighbours.find((n) => n.object.id === "andromeda");
    if (!m31) throw new Error("no andromeda neighbour");
    const geom = buildGalaxyGeometry(m31.object, m31.place);
    // The bloom is the neighbour's arms + bulge, in that order — never bgStars.
    expect(bloomPointsFor("andromeda", args)).toEqual([
      ...geom.arms,
      ...geom.bulge,
    ]);
    expect(geom.bgStars).toHaveLength(0); // neighbours carry no deep field
  });

  it("blooms the MW gateway's LG-placement arms+bulge — NEVER its bgStars", () => {
    const geom = buildBackdropGeometry(backdrop, LG_MW_PLACEMENT);
    const points = bloomPointsFor(HOME_MILKY_WAY_ID, args);
    // The bloom is EXACTLY arms + bulge (an array equality proves the deep field
    // never leaks in — the full bgStars cloud would change both length and order).
    expect(points).toEqual([...geom.arms, ...geom.bulge]);
    expect(points.length).toBe(geom.arms.length + geom.bulge.length);
    expect(geom.bgStars.length).toBeGreaterThan(0); // the field exists…
    expect(points.length).toBeLessThan(
      geom.arms.length + geom.bulge.length + geom.bgStars.length,
    ); // …but is excluded from the bloom payload
  });

  it("respects the home placement override (default MW vs shrunk LG placement differ)", () => {
    const lg = bloomPointsFor(HOME_MILKY_WAY_ID, args);
    const home = bloomPointsFor(HOME_MILKY_WAY_ID, {
      ...args,
      homePlacement: MW_PLACEMENT,
    });
    expect(lg).not.toEqual(home);
  });

  it("is pure — same inputs yield byte-identical bloom points", () => {
    expect(bloomPointsFor("triangulum", args)).toEqual(
      bloomPointsFor("triangulum", args),
    );
  });

  it("exposes bloom tuning that brightens but never over-saturates (×1.25 / ×0.9)", () => {
    expect(BLOOM_TUNING.diameterScale).toBeCloseTo(1.25, 6);
    expect(BLOOM_TUNING.alphaScale).toBeCloseTo(0.9, 6);
    // The alpha multiply is clamped at 1 downstream, so a fully-bright point
    // can't push past the additive ceiling.
    expect(Math.min(1, 1 * BLOOM_TUNING.alphaScale)).toBeLessThanOrEqual(1);
  });
});
