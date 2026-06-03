import { describe, expect, it } from "vitest";
import { buildBackdropGeometry } from "#/lib/galaxy/backdrop";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import type { GalaxyBackdrop } from "#/lib/galaxy/types";

const B = (over: Partial<GalaxyBackdrop> = {}): GalaxyBackdrop => ({
  seed: 7777,
  branches: 4,
  spin: 1,
  randomnessPower: 2.2,
  palette: "auroral",
  ...over,
});

const allPoints = (g: ReturnType<typeof buildBackdropGeometry>) => [
  ...g.bgStars,
  ...g.arms,
  ...g.bulge,
];

describe("buildBackdropGeometry", () => {
  it("is deterministic — same seed yields byte-identical geometry", () => {
    expect(buildBackdropGeometry(B())).toEqual(buildBackdropGeometry(B()));
  });

  it("produces a different sky for a different seed", () => {
    expect(buildBackdropGeometry(B({ seed: 1 })).arms).not.toEqual(
      buildBackdropGeometry(B({ seed: 2 })).arms,
    );
  });

  it("does not depend on palette (palette only tints color, never geometry)", () => {
    expect(buildBackdropGeometry(B({ palette: "ember" }))).toEqual(
      buildBackdropGeometry(B({ palette: "auroral" })),
    );
  });

  it("draws more arm stars as the branch count grows", () => {
    expect(
      buildBackdropGeometry(B({ branches: 4 })).arms.length,
    ).toBeGreaterThan(buildBackdropGeometry(B({ branches: 2 })).arms.length);
  });

  it("fills every structural layer", () => {
    const g = buildBackdropGeometry(B());
    expect(g.bgStars.length).toBeGreaterThan(0);
    expect(g.arms.length).toBeGreaterThan(0);
    expect(g.bulge.length).toBeGreaterThan(0);
  });

  it("keeps every point on the stage with sane attributes", () => {
    for (const p of allPoints(buildBackdropGeometry(B()))) {
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
  });
});
