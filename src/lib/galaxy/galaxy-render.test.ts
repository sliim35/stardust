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
  buildPointGeometry,
  buildSolarSystemScene,
  placementFor,
  solarPlacementFor,
  tuningFor,
} from "#/lib/galaxy/galaxy-render";
import { LG_MW_PLACEMENT, lgGalaxies } from "#/lib/galaxy/lg-composition";
import {
  GALAXY_CENTER,
  GALAXY_R,
  polarToXY,
  STAGE_H,
  STAGE_W,
} from "#/lib/galaxy/place";
import {
  HOME_MILKY_WAY_ID,
  localGroupNeighbours,
  REAL_OBJECTS,
  SOL_SYSTEM_STAR_ID,
  solarSystemObjects,
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
    const m31 = placementFor(byId("andromeda")); // size 0.78
    const lmc = placementFor(byId("lmc")); // size 0.42
    expect(m31.r).toBeGreaterThan(lmc.r);
    expect(m31.r).toBeCloseTo(GALAXY_R * 0.78, 6);
    expect(lmc.r).toBeCloseTo(GALAXY_R * 0.42, 6);
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
    expect(tuningFor(byId("triangulum")).branches).toBe(5); // M33 flocculent fragments (2026-06-10)
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
    expect(tuningFor(byId("andromeda"))).toEqual(tuningFor(byId("andromeda")));
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

  it("renders M33 with its OWN flocculent recipe — not the grand-design twin (2026-06-10)", () => {
    const m33 = byId("triangulum");
    expect(m33.shape).toBe("flocculent-spiral");
    const floc = buildGalaxyGeometry(m33);
    // The same object forced through the grand-design recipe must diverge —
    // the owner's complaint was exactly that the two were indistinguishable.
    const grand = buildGalaxyGeometry({ ...m33, shape: "spiral" });
    // Structural divergence, not just any-point delta: the flocculent budget
    // (knots·points + field sprinkle) ≠ the grand generator's per-arm budget —
    // a knob change that quietly reroutes M33 back through the spiral recipe
    // fails loudly here.
    expect(floc.arms.length).not.toBe(grand.arms.length);
    expect(floc.arms).not.toEqual(grand.arms);
    // Real M33's nucleus is tiny: the flocculent core stays well under the
    // MW-family bulge budget (560 points).
    expect(floc.bulge.length).toBeLessThan(grand.bulge.length);
    expect(floc.arms.length).toBeGreaterThan(0);
  });

  it("renders the magellanic cloud as a clumpy cloud (no clean spiral arms)", () => {
    // The clumpy recipe must still produce points; it just isn't the arm generator.
    const lmc = buildGalaxyGeometry(byId("lmc")); // magellanic
    expect(lmc.arms.length).toBeGreaterThan(0);
    // A different shape/seed (a spiral neighbour) → a different point cloud.
    const m33 = buildGalaxyGeometry(byId("triangulum"));
    expect(lmc.arms).not.toEqual(m33.arms);
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

// ── Tier-3 point/halo recipe (ADR-0016 §3, AC3) ────────────────────────────────
const byPlanet = (id: string): RealObject => {
  const o = solarSystemObjects().find((x) => x.id === id);
  if (!o) throw new Error(`no solar-system object ${id}`);
  return o;
};

describe("solarPlacementFor — a tier-3 body → its screen centre on the ring ladder", () => {
  it("seats Sol at the stage centre (placement r:0 → GALAXY_CENTER)", () => {
    const place = solarPlacementFor(byPlanet(SOL_SYSTEM_STAR_ID));
    expect(place.cx).toBeCloseTo(GALAXY_CENTER.x, 6);
    expect(place.cy).toBeCloseTo(GALAXY_CENTER.y, 6);
  });

  it("scales the body radius by its size, foreshortens y by the ecliptic tilt", () => {
    const jupiter = solarPlacementFor(byPlanet("jupiter")); // size 0.8
    const mercury = solarPlacementFor(byPlanet("mercury")); // size 0.225
    expect(jupiter.r).toBeGreaterThan(mercury.r);
    // tilt < 1 → the ring ellipses read foreshortened (seen from above).
    expect(jupiter.tilt).toBeGreaterThan(0);
    expect(jupiter.tilt).toBeLessThan(1);
  });

  it("places outer planets farther from Sol than inner ones (the monotone ladder)", () => {
    const centre = GALAXY_CENTER;
    const distOf = (id: string) => {
      const p = solarPlacementFor(byPlanet(id));
      return Math.hypot(p.cx - centre.x, p.cy - centre.y);
    };
    expect(distOf("neptune")).toBeGreaterThan(distOf("mercury"));
    expect(distOf("jupiter")).toBeGreaterThan(distOf("earth"));
  });

  it("keeps every planet clear of Sol's centre and on the stage", () => {
    for (const o of solarSystemObjects()) {
      const p = solarPlacementFor(o);
      expect(p.cx).toBeGreaterThanOrEqual(0);
      expect(p.cx).toBeLessThanOrEqual(STAGE_W);
      expect(p.cy).toBeGreaterThanOrEqual(0);
      expect(p.cy).toBeLessThanOrEqual(STAGE_H);
    }
  });
});

describe("buildPointGeometry — soft-glow point/halo for star · planet · marker (ADR-0016 §3)", () => {
  it("emits a soft-glow point cloud for a planet (a lit sphere, not a disk)", () => {
    const earth = byPlanet("earth");
    const g = buildPointGeometry(earth, solarPlacementFor(earth));
    // Points live in arms+bulge (so the canvas paints them through the same
    // back-to-front paintGlow path); no full-stage deep field per body.
    expect(g.arms.length + g.bulge.length).toBeGreaterThan(0);
    expect(g.bgStars.length).toBe(0);
  });

  it("clusters a planet's points tightly around its own centre (a point object, not a sprawling disk)", () => {
    const mars = byPlanet("mars");
    const place = solarPlacementFor(mars);
    const g = buildPointGeometry(mars, place);
    const pts = [...g.arms, ...g.bulge];
    for (const p of pts) {
      // every point sits within a small radius of the body centre — a planet is
      // a compact sphere, never the GALAXY_R·size sprawl of a disk recipe.
      expect(Math.hypot(p.x - place.cx, p.y - place.cy)).toBeLessThanOrEqual(
        place.r + 8,
      );
    }
  });

  it("renders Sol denser + brighter than any planet (the white-hot hero bloom)", () => {
    const sol = byPlanet(SOL_SYSTEM_STAR_ID);
    const earth = byPlanet("earth");
    const solG = buildPointGeometry(sol, solarPlacementFor(sol));
    const earthG = buildPointGeometry(earth, solarPlacementFor(earth));
    const count = (g: { arms: unknown[]; bulge: unknown[] }) =>
      g.arms.length + g.bulge.length;
    expect(count(solG)).toBeGreaterThan(count(earthG));
    const maxAlpha = (g: {
      arms: { alpha: number }[];
      bulge: { alpha: number }[];
    }) => Math.max(...[...g.arms, ...g.bulge].map((p) => p.alpha));
    expect(maxAlpha(solG)).toBeGreaterThanOrEqual(maxAlpha(earthG));
  });

  it("sizes a bigger planet's sphere larger than a smaller one (size → reach)", () => {
    const reach = (id: string) => {
      const o = byPlanet(id);
      const place = solarPlacementFor(o);
      const g = buildPointGeometry(o, place);
      return Math.max(
        ...[...g.arms, ...g.bulge].map((p) =>
          Math.hypot(p.x - place.cx, p.y - place.cy),
        ),
      );
    };
    expect(reach("jupiter")).toBeGreaterThan(reach("mercury"));
  });

  it("keeps every point on the stage (clamped + Math.round-quantized, SSR-safe)", () => {
    for (const o of solarSystemObjects()) {
      const g = buildPointGeometry(o, solarPlacementFor(o));
      for (const p of [...g.arms, ...g.bulge]) {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(STAGE_W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(STAGE_H);
      }
    }
  });

  it("is deterministic — same body yields byte-identical geometry (pure, hashStr-seeded)", () => {
    const jupiter = byPlanet("jupiter");
    const place = solarPlacementFor(jupiter);
    expect(buildPointGeometry(jupiter, place)).toEqual(
      buildPointGeometry(jupiter, place),
    );
  });

  it("routes star/planet/marker through the point recipe — NOT a disk recipe", () => {
    // A planet forced through this recipe must NOT match the clumpy/disk build:
    // a disk recipe scatters hundreds of points across GALAXY_R·size (a fuzzy
    // mini-galaxy); the point recipe keeps a compact sphere. The two diverge in
    // both point budget and spread.
    const earth = byPlanet("earth");
    const place = solarPlacementFor(earth);
    const point = buildPointGeometry(earth, place);
    const asDisk = buildGalaxyGeometry({ ...earth, shape: "spiral" }, place);
    expect(point.arms.length + point.bulge.length).not.toBe(
      asDisk.arms.length + asDisk.bulge.length,
    );
  });
});

describe("buildSolarSystemScene — the whole tier-3 scene (ADR-0016 §3)", () => {
  it("splits Sol (gold) from the 8 cool planets (palette), each with point geometry", () => {
    const scene = buildSolarSystemScene(solarSystemObjects());
    // Sol paints with the reserved gold sprite; the planets with the cool palette.
    expect(scene.gold.length).toBeGreaterThan(0);
    expect(scene.cool.length).toBeGreaterThan(0);
    // 8 cool bodies (planets) + 1 gold body (Sol) = 9 placed bodies.
    expect(scene.bodies).toHaveLength(9);
    const goldIds = scene.bodies.filter((b) => b.gold).map((b) => b.object.id);
    expect(goldIds).toEqual([SOL_SYSTEM_STAR_ID]);
  });

  it("draws 8 faint ring-ladder ellipses, Sol-centred, monotone outward, foreshortened", () => {
    const scene = buildSolarSystemScene(solarSystemObjects());
    expect(scene.rings).toHaveLength(8);
    for (const ring of scene.rings) {
      expect(ring.cx).toBeCloseTo(GALAXY_CENTER.x, 6);
      expect(ring.cy).toBeCloseTo(GALAXY_CENTER.y, 6);
      expect(ring.ry).toBeLessThan(ring.rx); // ecliptic foreshortening (tilt < 1)
    }
    // outer rings are larger than inner ones.
    for (let i = 1; i < scene.rings.length; i++) {
      expect(scene.rings[i].rx).toBeGreaterThan(scene.rings[i - 1].rx);
    }
  });

  it("is pure — same bodies yield byte-identical scene geometry", () => {
    expect(buildSolarSystemScene(solarSystemObjects())).toEqual(
      buildSolarSystemScene(solarSystemObjects()),
    );
  });
});
