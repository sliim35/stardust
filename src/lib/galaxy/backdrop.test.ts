import { describe, expect, it } from "vitest";
import {
  buildBackdropGeometry,
  type DiskPlacement,
  MW_PLACEMENT,
  placedExtent,
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

  it("treats pa as a true sky position angle — a thin disk turned 90° reads vertical (I-2)", () => {
    // Pre-I-2 the rotation ran BEFORE the tilt squash, so the silhouette was
    // always axis-aligned and the FINAL proof's diagonal Andromeda was
    // unreachable. Post-squash rotation = the projected ellipse itself rotates.
    const flat: DiskPlacement = { cx: 640, cy: 400, r: 120, tilt: 0.3, pa: 0 };
    const turned: DiskPlacement = { ...flat, pa: Math.PI / 2 };
    const spreads = (place: DiskPlacement) => {
      const g = buildBackdropGeometry(B(), place);
      const pts = [...g.arms, ...g.bulge]; // the disk body, not the deep field
      const xs = pts.map((p) => Math.abs(p.x - place.cx));
      const ys = pts.map((p) => Math.abs(p.y - place.cy));
      return { x: Math.max(...xs), y: Math.max(...ys) };
    };
    const a = spreads(flat);
    const b = spreads(turned);
    expect(a.x).toBeGreaterThan(a.y); // flat: wide, squashed
    expect(b.y).toBeGreaterThan(b.x); // turned 90°: tall, narrow
  });
});

describe("placedExtent — the projected half-extents of a placed disk", () => {
  it("reduces to (r, r·tilt) at pa 0 — the axis-aligned default", () => {
    const place: DiskPlacement = { cx: 0, cy: 0, r: 100, tilt: 0.5, pa: 0 };
    expect(placedExtent(place).x).toBeCloseTo(100, 6);
    expect(placedExtent(place).y).toBeCloseTo(50, 6);
  });

  it("swaps the axes at pa π/2 and bounds every generated point", () => {
    const place: DiskPlacement = {
      cx: 640,
      cy: 400,
      r: 100,
      tilt: 0.5,
      pa: Math.PI / 2,
    };
    expect(placedExtent(place).x).toBeCloseTo(50, 6);
    expect(placedExtent(place).y).toBeCloseTo(100, 6);
    const extent = placedExtent(place);
    const g = buildBackdropGeometry(B(), place);
    // The disk body (arms + bulge) stays inside the extents; bgStars are the
    // full-stage deep field and deliberately ignore the placement.
    for (const p of [...g.arms, ...g.bulge]) {
      expect(Math.abs(p.x - place.cx)).toBeLessThanOrEqual(extent.x + 1);
      expect(Math.abs(p.y - place.cy)).toBeLessThanOrEqual(extent.y + 1);
    }
  });
});
