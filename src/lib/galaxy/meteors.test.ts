import { describe, expect, it } from "vitest";
import {
  buildDeepMeteors,
  buildShooters,
  DEEP_METEOR_COUNT,
  type DeepMeteor,
  meteorHeadX,
  SHOOTER_ALPHA_CAP,
  SHOOTER_COUNT,
  type Shooter,
  STREAK_WINDOW,
  stepMeteor,
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
    expect(deepMax).toBeLessThan(SHOOTER_ALPHA_CAP); // L2 streaks peak at this cap
  });

  it("is slower than the slowest L2 shooter (far = drifts)", () => {
    const deepMax = Math.max(
      ...buildDeepMeteors(SEED).map((m: DeepMeteor) => m.speed),
    );
    const l2Min = Math.min(...buildShooters(SEED).map((s) => s.speed));
    expect(deepMax).toBeLessThan(l2Min);
  });
});

describe("stepMeteor (per-frame tail pixels — the math the draw loops used to inline)", () => {
  // A meteor whose phase puts it mid-streak at sec=0 (offset 0, period 6): prog=0
  // sits exactly at the window start, so the head is off the spawn edge.
  const base: Shooter = {
    y0: 200,
    slope: -0.2,
    dir: 1,
    speed: 300,
    len: 10,
    period: 6,
    offset: 0,
  };

  // The exact L1 (head-relative) configuration: width = w, y0Scale = h (normalized).
  const l1Opts = {
    width: 640,
    y0Scale: 400,
    slopeFrame: "head-relative" as const,
    alphaCap: 0.5,
  };
  // The exact L2 (stage-absolute) configuration: stage width, y0 as-is, SHOOTER_ALPHA_CAP.
  const l2Opts = {
    width: STAGE_W,
    y0Scale: 1,
    slopeFrame: "absolute" as const,
    alphaCap: SHOOTER_ALPHA_CAP,
  };

  // ---- visibility window (the `prog > STREAK_WINDOW ? continue` gate) ----

  it("returns NO pixels during the long pause (prog past the streak window)", () => {
    // sec placing prog just past STREAK_WINDOW → the streak is over, sky is quiet.
    const sec = STREAK_WINDOW * base.period + 0.001; // prog ≈ STREAK_WINDOW+ε
    expect(stepMeteor(base, sec, l2Opts)).toEqual([]);
  });

  it("returns a non-empty tail inside the visible window (one px per tail step)", () => {
    const px = stepMeteor(base, 0, l2Opts); // prog = 0 → visible
    expect(px).toHaveLength(base.len);
  });

  it("returns pixels right up to the window edge, then nothing just past it", () => {
    const inside = stepMeteor(base, STREAK_WINDOW * base.period - 1e-6, l2Opts);
    const outside = stepMeteor(
      base,
      STREAK_WINDOW * base.period + 1e-6,
      l2Opts,
    );
    expect(inside.length).toBe(base.len);
    expect(outside).toEqual([]);
  });

  // ---- head position (prog=0 off the edge; window end fully on/over the field) ----

  it("anchors the head at meteorHeadX for prog=0 and at the window end", () => {
    // The first tail pixel (k=0) sits at the rounded head x.
    const atStart = stepMeteor(base, 0, l2Opts);
    expect(atStart[0].x).toBe(Math.round(meteorHeadX(base, 0, STAGE_W)));

    // prog/STREAK_WINDOW = 1 at the end of the window → head at full travel.
    const endSec = STREAK_WINDOW * base.period - 1e-9;
    const atEnd = stepMeteor(base, endSec, l2Opts);
    const endProg = ((endSec + base.offset) / base.period) % 1;
    expect(atEnd[0].x).toBe(
      Math.round(meteorHeadX(base, endProg / STREAK_WINDOW, STAGE_W)),
    );
    // head advanced rightward across the window (dir +1).
    expect(atEnd[0].x).toBeGreaterThan(atStart[0].x);
  });

  // ---- fade falloff over the window (the `1 - prog/STREAK_WINDOW` factor) ----

  it("fades the whole streak out as it crosses the window (later prog = dimmer head)", () => {
    const early = stepMeteor(base, 0, l2Opts); // prog 0 → fade 1
    const late = stepMeteor(base, STREAK_WINDOW * base.period * 0.9, l2Opts);
    expect(late[0].alpha).toBeLessThan(early[0].alpha);
    expect(early[0].alpha).toBeCloseTo(SHOOTER_ALPHA_CAP, 10); // k=0, prog=0 → full cap
  });

  // ---- per-pixel alpha taper along the tail (the `1 - k/len` factor) ----

  it("tapers alpha along the tail — brightest at the head, dimmest at the tip", () => {
    const px = stepMeteor(base, 0, l2Opts);
    for (let k = 1; k < px.length; k++) {
      expect(px[k].alpha).toBeLessThan(px[k - 1].alpha);
    }
    // exact taper: (1 - k/len) * (1 - prog/window) * cap, prog=0.
    px.forEach((p, k) => {
      expect(p.alpha).toBeCloseTo((1 - k / base.len) * SHOOTER_ALPHA_CAP, 10);
    });
  });

  it("scales the peak alpha by the supplied cap (L1 per-meteor vs L2 SHOOTER_ALPHA_CAP)", () => {
    const l2 = stepMeteor(base, 0, l2Opts);
    const l1 = stepMeteor(base, 0, l1Opts);
    expect(l2[0].alpha).toBeCloseTo(SHOOTER_ALPHA_CAP, 10);
    expect(l1[0].alpha).toBeCloseTo(l1Opts.alphaCap, 10);
  });

  // ---- BOTH slope reference frames (the whole point of the parameterization) ----

  it("L2 frame: y is STAGE-absolute (y0 + x*slope), y0 used as-is", () => {
    const px = stepMeteor(base, 0, l2Opts);
    // y is computed from the RAW float x (then rounded), exactly like the old loop:
    // x_raw = head - dir*k, y = round(y0 + x_raw*slope). x_raw != round(x_raw).
    const head = meteorHeadX(base, 0, STAGE_W);
    px.forEach((p, k) => {
      const xRaw = head - base.dir * k;
      expect(p.y).toBe(Math.round(base.y0 + xRaw * base.slope));
    });
  });

  it("L1 frame: y is HEAD-relative (y0*scale + (x-head)*slope)", () => {
    const px = stepMeteor(base, 0, l1Opts);
    const head = meteorHeadX(base, 0, l1Opts.width);
    const y0 = base.y0 * l1Opts.y0Scale; // normalized × height
    px.forEach((p, k) => {
      const xRaw = head - base.dir * k; // raw float, like the old inline `x`
      expect(p.y).toBe(Math.round(y0 + (xRaw - head) * base.slope));
    });
  });

  it("the two frames give DIFFERENT y for the same meteor (asymmetry is preserved)", () => {
    // Same geometry, only the frame differs → the y columns must diverge, proving
    // the helper did not silently 'align' L1 to L2.
    const sameOpts = { ...l2Opts, y0Scale: 1 };
    const abs = stepMeteor(base, 0, sameOpts);
    const rel = stepMeteor(base, 0, {
      ...sameOpts,
      slopeFrame: "head-relative",
    });
    expect(abs.map((p) => p.y)).not.toEqual(rel.map((p) => p.y));
  });

  // ---- coordinate width + tail direction ----

  it("walks the tail BEHIND the head opposite the travel direction", () => {
    const lToR = stepMeteor({ ...base, dir: 1 }, 0, l2Opts);
    const rToL = stepMeteor({ ...base, dir: -1 }, 0, l2Opts);
    // dir +1: tail trails to the LEFT of the head (x decreases with k).
    expect(lToR[1].x).toBeLessThanOrEqual(lToR[0].x);
    // dir -1: tail trails to the RIGHT of the head (x increases with k).
    expect(rToL[1].x).toBeGreaterThanOrEqual(rToL[0].x);
  });

  it("uses the supplied width for the head sweep (L1 canvas w vs L2 stage W)", () => {
    // At prog>0 the swept span scales with width, so the head sits further along
    // for the wider field → width is actually threaded into meteorHeadX (at prog=0
    // both start on the same off-edge, span*0, so a mid-window prog is needed).
    const midWindow = STREAK_WINDOW * base.period * 0.5; // prog ≈ 0.5 of the window
    const wide = stepMeteor(base, midWindow, { ...l2Opts, width: 4000 });
    const narrow = stepMeteor(base, midWindow, { ...l2Opts, width: 200 });
    expect(wide[0].x).not.toBe(narrow[0].x);
  });

  // ---- determinism ----

  it("is deterministic — same inputs yield identical pixels", () => {
    expect(stepMeteor(base, 0.05, l2Opts)).toEqual(
      stepMeteor(base, 0.05, l2Opts),
    );
  });
});
