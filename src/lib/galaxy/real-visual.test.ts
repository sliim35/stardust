import { describe, expect, it } from "vitest";
import { polarToXY } from "#/lib/galaxy/place";
import {
  ARM_LABEL_SUPPRESS_PX,
  homeViewObjects,
  realDrawSpec,
  realScreenPos,
  visibleFeatureLabels,
} from "#/lib/galaxy/real-visual";
import { HOME_MILKY_WAY_ID, REAL_OBJECTS, SOL_ID } from "#/lib/galaxy/realdata";
import type { RealObject } from "#/lib/galaxy/types";

const find = (id: string): RealObject => {
  const o = REAL_OBJECTS.find((x) => x.id === id);
  if (!o) throw new Error(`no real object ${id}`);
  return o;
};

const ANDROMEDA_SPEC = find("andromeda");

describe("realScreenPos — polar placement → stage pixels (place.ts convention)", () => {
  it("maps a real object through the same polarToXY as stars", () => {
    const sol = find(SOL_ID);
    expect(realScreenPos(sol)).toEqual(
      polarToXY(sol.placement.r, sol.placement.angle),
    );
  });

  it("centers the home Milky Way (r=0) on the disk center", () => {
    expect(realScreenPos(find(HOME_MILKY_WAY_ID))).toEqual({ x: 640, y: 400 });
  });
});

describe("realDrawSpec — shape/kind → HD-2D soft-glow draw primitive", () => {
  it("draws every galaxy shape as a soft elliptical disk", () => {
    for (const id of ["lmc", "smc", "andromeda", "triangulum"]) {
      expect(realDrawSpec(find(id)).primitive).toBe("disk");
    }
    expect(realDrawSpec(find(HOME_MILKY_WAY_ID)).primitive).toBe("disk");
  });

  it("draws a nebula as a soft cloud", () => {
    for (const id of ["pillars", "crab", "orion"]) {
      expect(realDrawSpec(find(id)).primitive).toBe("cloud");
    }
  });

  it("draws a star (Sol) as a bright glowing point", () => {
    expect(realDrawSpec(find(SOL_ID)).primitive).toBe("point");
  });

  it("draws Sgr A* (marker) as a ring", () => {
    expect(realDrawSpec(find("sgra")).primitive).toBe("ring");
  });

  it("draws nothing on canvas for an arm label (it's a DOM label only)", () => {
    expect(realDrawSpec(find("orionArm")).primitive).toBe("none");
  });

  it("passes the object color through verbatim (the renderer never recolors)", () => {
    const sol = find(SOL_ID);
    expect(realDrawSpec(sol).color).toBe(sol.color);
  });

  it("scales the silhouette radius with the object size (bigger size → bigger px)", () => {
    const big = realDrawSpec({ ...find("andromeda"), size: 0.9 }).radiusPx;
    const small = realDrawSpec({ ...find("andromeda"), size: 0.2 }).radiusPx;
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(0);
  });

  it("carries the disk tilt + bar angle for a barred spiral (morphology cue)", () => {
    const spec = realDrawSpec(find(ANDROMEDA_SPEC.id));
    expect(spec.tilt).toBeCloseTo(ANDROMEDA_SPEC.tilt ?? 0, 6);
    expect(spec.barAngle).toBeCloseTo(ANDROMEDA_SPEC.barAngle ?? 0, 6);
  });

  it("makes the Magellanic/irregular disks lopsided (eccentricity < a round disk)", () => {
    // A round disk has aspect 1; ragged shapes read flatter/streakier.
    const irr = realDrawSpec(find("smc")).aspect;
    const round = realDrawSpec(find("andromeda")).aspect;
    expect(irr).toBeLessThanOrEqual(round);
    expect(irr).toBeGreaterThan(0);
  });

  it("keys the alpha to brightness (dimmer object → lower alpha)", () => {
    const bright = realDrawSpec({ ...find("sgra"), brightness: 0.9 }).alpha;
    const dim = realDrawSpec({ ...find("sgra"), brightness: 0.3 }).alpha;
    expect(bright).toBeGreaterThan(dim);
    expect(dim).toBeGreaterThan(0);
  });
});

describe("homeViewObjects — what the home Milky-Way tier renders", () => {
  it("renders the Milky-Way interior set (Sgr A*, Orion Arm, Sol, 3 nebulae)", () => {
    const ids = homeViewObjects().map((o) => o.id);
    expect(ids.sort()).toEqual(
      ["crab", "orion", "orionArm", "pillars", "sgra", SOL_ID].sort(),
    );
  });

  it("does not include the home Milky Way galaxy itself or the neighbours", () => {
    const ids = homeViewObjects().map((o) => o.id);
    expect(ids).not.toContain(HOME_MILKY_WAY_ID);
    expect(ids).not.toContain("andromeda");
    expect(ids).not.toContain("lmc");
  });

  it("is byte-stable across reads (SSR-safe — same source list)", () => {
    expect(homeViewObjects()).toEqual(homeViewObjects());
  });
});

describe("visibleFeatureLabels — arm-caption deconfliction (owner critique #1)", () => {
  // Tiny fixtures so the rule is tested in isolation from the real placement.
  const armLabel = (id: string, r: number, angle: number): RealObject => ({
    ...find("orionArm"),
    id,
    placement: { r, angle },
  });
  const poi = (id: string, r: number, angle: number): RealObject => ({
    ...find(SOL_ID),
    id,
    placement: { r, angle },
  });

  it("keeps every non-arm POI label (only arm captions are ever suppressed)", () => {
    const pois = homeViewObjects().filter((o) => o.kind !== "armLabel");
    const visible = visibleFeatureLabels(homeViewObjects()).map((o) => o.id);
    for (const p of pois) expect(visible).toContain(p.id);
  });

  it("suppresses an arm caption when a POI label sits within the threshold", () => {
    const arm = armLabel("armX", 0.5, 0);
    // A POI a few px away (well inside ARM_LABEL_SUPPRESS_PX).
    const near = poi("near", 0.51, 0);
    const visible = visibleFeatureLabels([arm, near]).map((o) => o.id);
    expect(visible).not.toContain("armX");
    expect(visible).toContain("near");
  });

  it("keeps an arm caption when no POI is within the threshold", () => {
    const arm = armLabel("armX", 0.5, 0);
    const far = poi("far", 0.5, Math.PI); // opposite side of the disk
    const aArm = realScreenPos(arm);
    const aFar = realScreenPos(far);
    expect(Math.hypot(aArm.x - aFar.x, aArm.y - aFar.y)).toBeGreaterThan(
      ARM_LABEL_SUPPRESS_PX,
    );
    const visible = visibleFeatureLabels([arm, far]).map((o) => o.id);
    expect(visible).toContain("armX");
  });

  it("renders the Orion Arm caption in the real home view (nudged clear of Sol)", () => {
    // The data nudge (#1) must leave the Orion Arm > threshold from every POI, so
    // it survives its own suppression rule and reads cleanly on the real stage.
    const visible = visibleFeatureLabels(homeViewObjects()).map((o) => o.id);
    expect(visible).toContain("orionArm");
  });

  it("keeps the Orion Arm caption clear of Sol's lockup (≥ threshold px)", () => {
    const arm = realScreenPos(find("orionArm"));
    const sol = realScreenPos(find(SOL_ID));
    expect(Math.hypot(arm.x - sol.x, arm.y - sol.y)).toBeGreaterThanOrEqual(
      ARM_LABEL_SUPPRESS_PX,
    );
  });
});
