import { describe, expect, it } from "vitest";
import {
  buildDeepMeteors,
  buildShooters,
  DEEP_METEOR_COUNT,
  type DeepMeteor,
  meteorHeadX,
  SHOOTER_COUNT,
  type Shooter,
} from "#/lib/galaxy/meteors";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";

const SEED = 7777;

describe("buildShooters (L2 meteors — variety, not just volume #54)", () => {
  it("is deterministic — same seed yields identical shooters", () => {
    expect(buildShooters(SEED)).toEqual(buildShooters(SEED));
  });

  it("produces different shooters for a different seed", () => {
    expect(buildShooters(1)).not.toEqual(buildShooters(2));
  });

  it("bumps the count from 4 to ~8", () => {
    expect(SHOOTER_COUNT).toBe(8);
    expect(buildShooters(SEED)).toHaveLength(8);
  });

  it("travels BOTH ways — some L→R (dir +1) and some R→L (dir -1)", () => {
    const dirs = new Set(buildShooters(SEED).map((s) => s.dir));
    expect(dirs.has(1)).toBe(true);
    expect(dirs.has(-1)).toBe(true);
  });

  it("each dir is exactly +1 or -1", () => {
    for (const s of buildShooters(SEED)) {
      expect([1, -1]).toContain(s.dir);
    }
  });

  it("slants BOTH ways — some up-slanting and some down-slanting", () => {
    const slopes = buildShooters(SEED).map((s) => s.slope);
    expect(slopes.some((m) => m > 0)).toBe(true);
    expect(slopes.some((m) => m < 0)).toBe(true);
  });

  it("spans the FULL height, not just the top 70%", () => {
    const ys = buildShooters(SEED).map((s) => s.y0);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(STAGE_H);
    }
    // at least one shooter must live in the lower third the old code never reached
    expect(ys.some((y) => y > STAGE_H * 0.7)).toBe(true);
  });

  it("keeps sane, widened timing/geometry ranges (still brief + occasional)", () => {
    for (const s of buildShooters(SEED)) {
      expect(s.len).toBeGreaterThan(0);
      expect(s.speed).toBeGreaterThan(0);
      expect(s.period).toBeGreaterThanOrEqual(4); // long pauses → occasional, not busy
      expect(s.offset).toBeGreaterThanOrEqual(0);
    }
  });

  // The variety must hold across the seed space, not by luck on one seed — otherwise
  // most real skies would still read as the old left-corner trickle (#54).
  it.each([
    7777, 1, 2, 42, 9999, 12345, 0, 555,
  ])("has both directions, both slope signs, and full-height reach for seed %i", (seed) => {
    const sh = buildShooters(seed);
    const dirs = new Set(sh.map((s) => s.dir));
    expect(dirs.has(1) && dirs.has(-1)).toBe(true);
    expect(sh.some((s) => s.slope > 0)).toBe(true);
    expect(sh.some((s) => s.slope < 0)).toBe(true);
    expect(sh.some((s) => s.y0 > STAGE_H * 0.7)).toBe(true);
  });
});

describe("meteorHeadX (pure travel — proves direction)", () => {
  const lToR: Shooter = {
    y0: 100,
    slope: -0.2,
    dir: 1,
    speed: 260,
    len: 80,
    period: 6,
    offset: 0,
  };
  const rToL: Shooter = { ...lToR, dir: -1 };

  it("L→R head advances rightward as progress grows", () => {
    const a = meteorHeadX(lToR, 0);
    const b = meteorHeadX(lToR, 0.18);
    expect(b).toBeGreaterThan(a);
  });

  it("R→L head advances leftward as progress grows", () => {
    const a = meteorHeadX(rToL, 0);
    const b = meteorHeadX(rToL, 0.18);
    expect(b).toBeLessThan(a);
  });

  it("starts each direction off the correct edge (enters, not pops in)", () => {
    expect(meteorHeadX(lToR, 0)).toBeLessThanOrEqual(0); // off the left
    expect(meteorHeadX(rToL, 0)).toBeGreaterThanOrEqual(STAGE_W); // off the right
  });
});

describe("buildDeepMeteors (L1 parallax depth — fainter + slower than L2)", () => {
  it("is deterministic — same seed yields identical meteors", () => {
    expect(buildDeepMeteors(SEED)).toEqual(buildDeepMeteors(SEED));
  });

  it("adds 2–3 meteors (the docstring's promised-but-missing shooting stars)", () => {
    expect(DEEP_METEOR_COUNT).toBeGreaterThanOrEqual(2);
    expect(DEEP_METEOR_COUNT).toBeLessThanOrEqual(3);
    expect(buildDeepMeteors(SEED)).toHaveLength(DEEP_METEOR_COUNT);
  });

  it("uses 0..1 normalized coordinates (full-viewport, not stage px)", () => {
    for (const m of buildDeepMeteors(SEED)) {
      expect(m.y0).toBeGreaterThanOrEqual(0);
      expect(m.y0).toBeLessThanOrEqual(1);
    }
  });

  it("travels both ways like L2", () => {
    const dirs = new Set(buildDeepMeteors(SEED).map((m) => m.dir));
    expect(dirs.size).toBeGreaterThan(0);
    for (const d of dirs) expect([1, -1]).toContain(d);
  });

  it("is dimmer than the brightest L2 streak (parallax: far = faint)", () => {
    const deepMax = Math.max(...buildDeepMeteors(SEED).map((m) => m.alpha));
    expect(deepMax).toBeLessThan(0.9); // L2 streaks peak near ~0.9
  });

  it("is slower than the slowest L2 shooter (far = drifts)", () => {
    const deepMax = Math.max(
      ...buildDeepMeteors(SEED).map((m: DeepMeteor) => m.speed),
    );
    const l2Min = Math.min(...buildShooters(SEED).map((s) => s.speed));
    expect(deepMax).toBeLessThan(l2Min);
  });
});
