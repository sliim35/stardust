import { describe, expect, it } from "vitest";
import { polarToXY } from "#/lib/galaxy/place";
import {
  homeViewObjects,
  realDrawSpec,
  realScreenPos,
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
