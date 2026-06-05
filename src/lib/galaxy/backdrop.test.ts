import { describe, expect, it } from "vitest";
import {
  buildBackdropGeometry,
  type DiskPlacement,
  MW_PLACEMENT,
} from "#/lib/galaxy/backdrop";
import {
  DISK_TILT,
  GALAXY_CENTER,
  GALAXY_R,
  STAGE_H,
  STAGE_W,
} from "#/lib/galaxy/place";
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

// ── I-1: placement-aware geometry (ADR-0011 §1) ───────────────────────────────
// The CRITICAL INVARIANT: making the generator placement-aware MUST NOT move a
// single Milky-Way pixel. The default-arg call path stays byte-identical to today,
// and an explicit MW_PLACEMENT call equals the default call.

describe("MW_PLACEMENT — the default Milky-Way placement", () => {
  it("derives from the locked stage constants (centre / radius / no rotation)", () => {
    expect(MW_PLACEMENT.cx).toBe(GALAXY_CENTER.x);
    expect(MW_PLACEMENT.cy).toBe(GALAXY_CENTER.y);
    expect(MW_PLACEMENT.r).toBe(GALAXY_R);
    expect(MW_PLACEMENT.tilt).toBe(DISK_TILT);
    expect(MW_PLACEMENT.pa).toBe(0);
  });
});

describe("buildBackdropGeometry — placement-aware (ADR-0011 §1)", () => {
  it("is byte-identical with the default arg and an explicit MW_PLACEMENT", () => {
    expect(buildBackdropGeometry(B(), MW_PLACEMENT)).toEqual(
      buildBackdropGeometry(B()),
    );
  });

  it("keeps the default render byte-identical to the pre-I-1 golden output", () => {
    // Golden values captured from `main` BEFORE the placement param existed — these
    // pin the invariant that no MW pixel moves (the proof + ADR-0011 §1 promise).
    const g = buildBackdropGeometry(B());
    expect(g.bgStars.length).toBe(560);
    expect(g.arms.length).toBe(1640);
    expect(g.bulge.length).toBe(560);
    expect(g.bgStars[0]).toEqual({
      x: 158,
      y: 482,
      size: 1,
      alpha: 0.3130390144884586,
      phase: 0.9664490101858974,
      warm: 0.4287590649910271,
    });
    expect(g.arms[0]).toEqual({
      x: 688,
      y: 433,
      size: 1,
      alpha: 0.6636750916019082,
      phase: 0.2699849351774901,
      warm: 0.8757053910754621,
    });
    expect(g.arms[Math.floor(g.arms.length / 2)]).toEqual({
      x: 893,
      y: 415,
      size: 1,
      alpha: 0.8333916552364826,
      phase: 0.8257346234750003,
      warm: 0.5082552762236445,
    });
    expect(g.bulge[0]).toEqual({
      x: 638,
      y: 401,
      size: 2,
      alpha: 0.5951981797232293,
      phase: 0.824672369286418,
      warm: 0.7172556032426656,
    });
  });

  it("recenters the disk: a smaller-radius placement at a new centre shifts the bulge there", () => {
    const here: DiskPlacement = { cx: 200, cy: 150, r: 60, tilt: 0.74, pa: 0 };
    const g = buildBackdropGeometry(B(), here);
    // The bulge clusters around the disk centre — its mean lands near (cx, cy).
    const meanX = g.bulge.reduce((s, p) => s + p.x, 0) / g.bulge.length;
    const meanY = g.bulge.reduce((s, p) => s + p.y, 0) / g.bulge.length;
    expect(Math.abs(meanX - here.cx)).toBeLessThan(30);
    expect(Math.abs(meanY - here.cy)).toBeLessThan(30);
    // …and every point sits within the new disk radius footprint, not the MW one.
    for (const p of [...g.arms, ...g.bulge]) {
      expect(Math.abs(p.x - here.cx)).toBeLessThanOrEqual(here.r + 1);
      expect(Math.abs(p.y - here.cy)).toBeLessThanOrEqual(here.r + 1);
    }
  });

  it("rotates the disk by the position angle (pa) — alpha/phase unchanged, positions move", () => {
    const base: DiskPlacement = { ...MW_PLACEMENT, cx: 400, cy: 300, r: 100 };
    const rotated: DiskPlacement = { ...base, pa: Math.PI / 3 };
    const a = buildBackdropGeometry(B(), base);
    const b = buildBackdropGeometry(B(), rotated);
    // Same seed → same per-point alpha/phase/warm/size (pa only rotates positions).
    expect(b.arms.map((p) => p.alpha)).toEqual(a.arms.map((p) => p.alpha));
    expect(b.arms.map((p) => p.phase)).toEqual(a.arms.map((p) => p.phase));
    // …but the rotation actually moves points.
    expect(b.arms.map((p) => [p.x, p.y])).not.toEqual(
      a.arms.map((p) => [p.x, p.y]),
    );
  });

  it("clamps placed points to the stage (off-stage placements never throw or escape)", () => {
    const offEdge: DiskPlacement = { cx: 0, cy: 0, r: 400, tilt: 0.74, pa: 0 };
    for (const p of allPoints(buildBackdropGeometry(B(), offEdge))) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(STAGE_W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(STAGE_H);
    }
  });
});
