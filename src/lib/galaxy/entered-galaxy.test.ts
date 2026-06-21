import { describe, expect, it } from "vitest";
import type { BackdropPoint, DiskPlacement } from "#/lib/galaxy/backdrop";
import { buildBackdropGeometry } from "#/lib/galaxy/backdrop";
import {
  buildEnteredGalaxyGeometry,
  enteredObjectFor,
  placementFor,
} from "#/lib/galaxy/galaxy-render";
import { GALAXY_R, STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import { REAL_OBJECTS } from "#/lib/galaxy/realdata";
import type { RealObject } from "#/lib/galaxy/types";

const byId = (id: string): RealObject => {
  const o = REAL_OBJECTS.find((x) => x.id === id);
  if (!o) throw new Error(`no real object ${id}`);
  return o;
};

const mw = byId("home");
const m31 = byId("andromeda");
const m33 = byId("triangulum");
const lmc = byId("lmc");

const allPoints = (g: {
  bgStars: BackdropPoint[];
  arms: BackdropPoint[];
  bulge: BackdropPoint[];
}): BackdropPoint[] => [...g.bgStars, ...g.arms, ...g.bulge];

// A face-on, centred placement so disk-space distribution metrics are not
// distorted by tilt/position-angle (the projection is tested separately).
const FACE_ON: DiskPlacement = {
  cx: STAGE_W / 2,
  cy: STAGE_H / 2,
  r: GALAXY_R,
  tilt: 1,
  pa: 0,
};

describe("buildEnteredGalaxyGeometry — the tier-2 entered-galaxy seam (#226, ADR-0011 §1 amendment)", () => {
  // AC2/AC7 — the entered seam carries its OWN full-stage deep field (the home MW
  // disk is gone; without a deep field that galaxy's sky goes empty).
  it("returns a non-empty bgStars deep field (the entered scene keeps its starfield)", () => {
    for (const o of [m31, m33, lmc]) {
      const g = buildEnteredGalaxyGeometry(o, placementFor(o));
      expect(g.bgStars.length).toBeGreaterThan(0);
      expect(g.arms.length).toBeGreaterThan(0);
      expect(g.bulge.length).toBeGreaterThan(0);
    }
  });

  // AC6/AC7 — deterministic + SSR-safe: byte-identical on repeat calls.
  it("is deterministic — same object + placement yields byte-identical geometry", () => {
    expect(buildEnteredGalaxyGeometry(lmc, placementFor(lmc))).toEqual(
      buildEnteredGalaxyGeometry(lmc, placementFor(lmc)),
    );
  });

  // AC7 — every point lands on-stage with sane attributes (reuse the invariants).
  it("keeps every point on the stage with sane attributes", () => {
    for (const o of [m31, m33, lmc]) {
      for (const p of allPoints(
        buildEnteredGalaxyGeometry(o, placementFor(o)),
      )) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(STAGE_W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(STAGE_H);
        expect([1, 2]).toContain(p.size);
        expect(p.alpha).toBeGreaterThan(0);
        expect(p.alpha).toBeLessThanOrEqual(1);
        expect(p.phase).toBeGreaterThanOrEqual(0);
        expect(p.phase).toBeLessThan(1);
      }
    }
  });

  // AC2 — entry is shape-aware: forcing the entered galaxy through the old
  // shape-agnostic grand generator (`buildBackdropGeometry`) MUST diverge.
  it("is shape-aware — the entered LMC diverges from the shape-agnostic grand generator", () => {
    const place = placementFor(lmc);
    const entered = buildEnteredGalaxyGeometry(lmc, place);
    // The old (buggy) path painted every entered disk with the MW grand spiral.
    const grand = buildBackdropGeometry(
      { seed: 1, branches: 3, spin: 1, randomnessPower: 2.2, palette: "ember" },
      place,
    );
    expect(entered.arms.length).not.toBe(grand.arms.length);
    expect(entered.arms).not.toEqual(grand.arms);
  });

  it("dispatches M33 through its flocculent recipe (small tiny core, beaded arms)", () => {
    const place = placementFor(m33);
    const floc = buildEnteredGalaxyGeometry(m33, place);
    // The MW-family bulge is 560; the flocculent nucleus is much smaller.
    expect(floc.bulge.length).toBeLessThan(560);
  });
});

describe("AC6 — per-galaxy structural divergence on the entered view", () => {
  // Compare disk-space distributions face-on, so tilt/pa can't mask the difference.
  const disk = (o: RealObject): BackdropPoint[] => {
    const g = buildEnteredGalaxyGeometry(o, FACE_ON);
    return [...g.arms, ...g.bulge];
  };

  // Angular histogram of points in disk space (16 bins), folded to [0, π) so a
  // bar's two opposite lobes count as ONE axis.
  const angularHistogram = (
    pts: readonly BackdropPoint[],
    bins = 16,
  ): number[] => {
    const h = new Array<number>(bins).fill(0);
    for (const p of pts) {
      let a = Math.atan2(p.y - FACE_ON.cy, p.x - FACE_ON.cx);
      a = ((a % Math.PI) + Math.PI) % Math.PI;
      h[Math.min(bins - 1, Math.floor((a / Math.PI) * bins))]++;
    }
    return h;
  };

  it("makes M31 grand ≠ MW grand (a measurably different arm signature — not a recolored MW)", () => {
    const a = buildEnteredGalaxyGeometry(mw, FACE_ON).arms;
    const b = buildEnteredGalaxyGeometry(m31, FACE_ON).arms;
    // AC4: M31's grand tuning gives it a different arm point budget than the MW —
    // not merely a different seed/placement of the identical generator.
    expect(a.length).not.toBe(b.length);
  });

  it("makes M33 flocculent ≠ both grands (a different point budget)", () => {
    const floc = buildEnteredGalaxyGeometry(m33, FACE_ON).arms.length;
    const mwArms = buildEnteredGalaxyGeometry(mw, FACE_ON).arms.length;
    const m31Arms = buildEnteredGalaxyGeometry(m31, FACE_ON).arms.length;
    expect(floc).not.toBe(mwArms);
    expect(floc).not.toBe(m31Arms);
  });

  it("makes the LMC's distribution differ measurably from the MW's", () => {
    const norm = (h: number[]): number[] => {
      const s = h.reduce((a, b) => a + b, 0);
      return h.map((v) => v / s);
    };
    const mwN = norm(angularHistogram(disk(mw)));
    const lmcN = norm(angularHistogram(disk(lmc)));
    const l1 = mwN.reduce((a, v, i) => a + Math.abs(v - lmcN[i]), 0);
    expect(l1).toBeGreaterThan(0.2);
  });

  // AC3/AC4 — the LMC bar: a linear over-density along the disk-space barAngle
  // axis vs the perpendicular. A bar-less clumpy cloud is radially symmetric, so
  // this ratio is ~1; the bar pushes it well above 1.
  it("exposes a detectable bar — over-density along the barAngle axis (AC4)", () => {
    const lmcWithBar: RealObject = { ...lmc, barAngle: 0 };
    const pts = buildEnteredGalaxyGeometry(lmcWithBar, FACE_ON).arms;
    const band = Math.PI / 8;
    const near = (target: number): number =>
      pts.filter((p) => {
        let a = Math.atan2(p.y - FACE_ON.cy, p.x - FACE_ON.cx);
        a = ((a % Math.PI) + Math.PI) % Math.PI;
        const d = Math.min(
          Math.abs(a - target),
          Math.PI - Math.abs(a - target),
        );
        return d < band;
      }).length;
    const alongBar = near(0); // bar axis (barAngle 0)
    const acrossBar = near(Math.PI / 2); // perpendicular
    expect(alongBar).toBeGreaterThan(acrossBar * 1.4);
  });

  it("makes the LMC scatter lopsided — angular mass weighted to one side of centre (AC3)", () => {
    const pts = buildEnteredGalaxyGeometry(lmc, FACE_ON).arms;
    let left = 0;
    let right = 0;
    for (const p of pts) {
      if (p.x >= FACE_ON.cx) right++;
      else left++;
    }
    const ratio = Math.max(left, right) / Math.max(1, Math.min(left, right));
    expect(ratio).toBeGreaterThan(1.15);
  });
});

describe("enteredObjectFor — the builder selection seam (#226, AC7)", () => {
  it("returns null for the home MW (null / 'home' / unknown) — keeps the untouched path", () => {
    expect(enteredObjectFor(null)).toBeNull();
    expect(enteredObjectFor(undefined)).toBeNull();
    expect(enteredObjectFor("home")).toBeNull();
    expect(enteredObjectFor("not-a-galaxy")).toBeNull();
  });

  it("resolves an entered neighbour id to its RealObject", () => {
    expect(enteredObjectFor("andromeda")?.id).toBe("andromeda");
    expect(enteredObjectFor("lmc")?.shape).toBe("magellanic");
    expect(enteredObjectFor("triangulum")?.shape).toBe("flocculent-spiral");
  });
});

describe("AC8 — projection composes (tilt/pa/r turn the whole entered silhouette)", () => {
  it("an inclined, rotated placement moves every entered morphology's points", () => {
    for (const o of [m31, m33, lmc]) {
      const flat: DiskPlacement = {
        cx: 640,
        cy: 400,
        r: 120,
        tilt: 0.4,
        pa: 0,
      };
      const turned: DiskPlacement = { ...flat, pa: Math.PI / 2 };
      const a = buildEnteredGalaxyGeometry(o, flat);
      const b = buildEnteredGalaxyGeometry(o, turned);
      // pa only rotates positions — same per-point alpha/phase, moved coordinates.
      expect(b.arms.map((p) => p.alpha)).toEqual(a.arms.map((p) => p.alpha));
      expect(b.arms.map((p) => [p.x, p.y])).not.toEqual(
        a.arms.map((p) => [p.x, p.y]),
      );
    }
  });
});
