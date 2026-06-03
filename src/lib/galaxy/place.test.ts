import { describe, expect, it } from "vitest";
import {
  DISK_TILT,
  GALAXY_CENTER,
  GALAXY_R,
  layoutStars,
  polarToXY,
  SOL_POS,
  STAGE_H,
  STAGE_W,
} from "#/lib/galaxy/place";

describe("geometry constants (locked by the design spec)", () => {
  it("matches the prototype stage", () => {
    expect([STAGE_W, STAGE_H]).toEqual([1280, 800]);
    expect(GALAXY_CENTER).toEqual({ x: 640, y: 400 });
    expect([GALAXY_R, DISK_TILT]).toEqual([360, 0.74]);
  });
});

describe("polarToXY", () => {
  it("maps the center (r=0) to GALAXY_CENTER regardless of angle", () => {
    expect(polarToXY(0, 0)).toEqual(GALAXY_CENTER);
    expect(polarToXY(0, 1.23)).toEqual(GALAXY_CENTER);
  });

  it("applies the disk tilt to the y axis only", () => {
    const p = polarToXY(1, Math.PI / 2);
    expect(p.x).toBeCloseTo(GALAXY_CENTER.x, 6);
    expect(p.y).toBeCloseTo(GALAXY_CENTER.y + GALAXY_R * DISK_TILT, 6);
  });

  it("places Irina's seeded (r, angle) at the prototype's Sol marker", () => {
    // seed.ts DEEP_STAR uses r=0.366, angle=0.423, precomputed from SOL_POS.
    const p = polarToXY(0.366, 0.423);
    expect(p.x).toBeCloseTo(SOL_POS.x, 0); // within ~0.5px
    expect(p.y).toBeCloseTo(SOL_POS.y, 0);
  });
});

describe("layoutStars", () => {
  const a = { id: "a", r: 0.5, angle: 0.3 };
  const b = { id: "b", r: 0.8, angle: 2.1 };

  it("positions each star at its polarToXY", () => {
    expect(layoutStars([a])).toEqual({ a: polarToXY(a.r, a.angle) });
  });

  it("never moves an existing star when another is appended (addStar invariant)", () => {
    const before = layoutStars([a]);
    const after = layoutStars([a, b]);
    expect(after.a).toEqual(before.a);
  });
});
