/**
 * Pure, seeded meteor ("shooting star") models for the galaxy's live overlays —
 * the headless half of the L2 `GalaxyBackdrop` streaks and the L1 `DeepStarfield`
 * far-meteors. Extracted so the per-meteor variety (origin edge, slope sign,
 * full-height band, count, widened ranges) is unit-testable in node, while the
 * components keep only the canvas/RAF drawing (story #55, grounded in spike #54
 * `docs/research/2026-06-03-add-life-to-universe.md`).
 *
 * Spike #54 found the old 4 L2 shooters all started at the LEFT edge, all slanted
 * the SAME way (slope always negative), and all sat in the TOP 70% — so they read
 * as a sparse left-corner trickle. The fix is variety, not volume: each meteor now
 * randomizes its travel direction (`dir` ±1 → L→R and R→L), its slope sign (up- and
 * down-slanting), and spans the full stage height; L1 gets 2–3 fainter, slower ones
 * for parallax depth (its docstring already promised "the occasional shooting star").
 *
 * Everything is a deterministic function of the seed (mulberry32 — ADR-0003): the
 * same seed yields identical meteors, so SSR and the client never disagree and a
 * Worker never touches a module-scope `Math.random()`/`Date.now()`. Reduced motion
 * is honored by the components (they never start the RAF loop), not here.
 */

import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import { mulberry32 } from "#/lib/galaxy/rng";

/** Travel direction: +1 enters from the left → right, -1 enters from the right → left. */
export type MeteorDir = 1 | -1;

/** An L2 streak: a bright, brief, full-field shooting star over the disk. */
export type Shooter = {
  y0: number; // stage-px vertical origin, anywhere across the full height
  slope: number; // signed dy/dx — both up- and down-slanting
  dir: MeteorDir; // origin edge / travel direction
  speed: number; // px-ish travel scalar (also stretches the swept distance)
  len: number; // tail length in pixels
  period: number; // seconds between appearances (long → occasional, not busy)
  offset: number; // seconds phase offset so the 8 don't fire together
};

/** An L1 far-meteor: a fainter, slower streak in normalized full-viewport space. */
export type DeepMeteor = {
  y0: number; // 0..1 of viewport height (L1 fills the viewport, not the stage)
  slope: number; // signed dy/dx (in normalized space)
  dir: MeteorDir;
  speed: number; // slower than any L2 shooter (far = drifts)
  len: number; // tail length in px
  alpha: number; // dimmer than the L2 streaks (far = faint)
  period: number; // seconds between appearances
  offset: number;
};

/** ~4 → ~8: more meteors, but spread over long periods so the sky stays calm. */
export const SHOOTER_COUNT = 8;

/** 2–3 faint depth meteors on L1 (spike #54: "occasional shooting star" promised, none built). */
export const DEEP_METEOR_COUNT = 3;

/** How far off-stage a streak begins, so it slides IN rather than popping into view. */
const SPAWN_MARGIN = 120;
/** Fraction of the period a streak is visible — the rest is the long pause. */
export const STREAK_WINDOW = 0.18;

/**
 * Peak alpha of an L2 streak's brightest pixel (head, fully faded-in). The single
 * source of truth for that cap: `GalaxyBackdrop`'s draw loop multiplies by it, and
 * the L1 far-meteors stay dimmer than it (see `buildDeepMeteors`'s `alpha`, asserted
 * in `meteors.test.ts`) for parallax. Bump here to retune both at once.
 */
export const SHOOTER_ALPHA_CAP = 0.9;

/** A signed slope: a small magnitude with an independently-chosen sign (#54 variety). */
const signedSlope = (rng: () => number): number =>
  (rng() < 0.5 ? -1 : 1) * (0.1 + rng() * 0.25);

/**
 * The L2 shooters for a backdrop seed. Each gets its own seeded stream (xor-folded
 * seed, mirroring `backdrop.ts`) so re-tuning one never reshuffles the others.
 */
export const buildShooters = (seed: number): Shooter[] =>
  Array.from({ length: SHOOTER_COUNT }, (_, i) => {
    const r = mulberry32((seed ^ (0x51ed + i * 0x9e37)) >>> 0);
    return {
      y0: r() * STAGE_H, // full height (was * 0.7)
      slope: signedSlope(r), // both ways (was always negative)
      dir: r() < 0.5 ? -1 : 1, // both edges (was always left → right)
      speed: 180 + r() * 260, // widened (was 220 + 200)
      len: 50 + r() * 100, // widened (was 60 + 70)
      period: 5 + r() * 8, // longer pauses → stays occasional at 8 count (was 4 + 5)
      offset: r() * (5 + 8), // spread across the widest period so they don't sync
    };
  });

/**
 * The L1 far-meteors — fainter and slower than every L2 shooter, in normalized
 * (0..1 vertical) space because L1 fills the viewport rather than the fixed stage.
 */
export const buildDeepMeteors = (seed: number): DeepMeteor[] =>
  Array.from({ length: DEEP_METEOR_COUNT }, (_, i) => {
    const r = mulberry32((seed ^ (0xbeef + i * 0x85eb)) >>> 0);
    return {
      y0: r(), // 0..1 of viewport height
      slope: signedSlope(r),
      dir: r() < 0.5 ? -1 : 1,
      speed: 60 + r() * 90, // 60..150 — below L2's 180 floor (far = drifts)
      len: 26 + r() * 30,
      alpha: 0.3 + r() * 0.25, // 0.30..0.55 — dimmer than L2's SHOOTER_ALPHA_CAP
      period: 9 + r() * 9, // rarer than L2 (deep field is quiet)
      offset: r() * (9 + 9),
    };
  });

/**
 * Head x-position of a streak at normalized progress `prog` (0..1 over its visible
 * window). Pure so the travel direction is testable: `dir +1` slides in from off the
 * left and advances right; `dir -1` slides in from off the right and advances left.
 * The swept distance stretches with `speed` so faster meteors cover more ground.
 */
export const meteorHeadX = (
  m: Pick<Shooter, "dir" | "speed">,
  prog: number,
  stageW: number = STAGE_W,
): number => {
  const span = (stageW + 2 * SPAWN_MARGIN) * (m.speed / 300);
  return m.dir === 1
    ? -SPAWN_MARGIN + prog * span
    : stageW + SPAWN_MARGIN - prog * span;
};

/** The minimal per-meteor shape `stepMeteor` reads (shared by `Shooter`/`DeepMeteor`). */
type Steppable = Pick<
  Shooter,
  "y0" | "slope" | "dir" | "speed" | "len" | "period" | "offset"
>;

/** One tail pixel to draw: integer canvas coords + the alpha to fill it with. */
export type TailPixel = { x: number; y: number; alpha: number };

/**
 * How a layer maps a meteor's normalized model onto its canvas. The two galaxy
 * overlays share the *stepping* math (`stepMeteor`) but differ only in these four
 * knobs — kept explicit so the deliberate L1↔L2 asymmetry stays visible and tested:
 *
 * - `width`     — head-sweep field width: L1 the live canvas `w`, L2 the fixed `STAGE_W`.
 * - `y0Scale`   — vertical-origin scale: L2 `1` (y0 already stage-px), L1 the canvas
 *                 height (y0 is 0..1 normalized → `m.y0 * h`).
 * - `slopeFrame`— where the slope pivots: L2 `"absolute"` (`x * slope`, relative to the
 *                 stage origin), L1 `"head-relative"` (`(x - head) * slope`, tail pivots
 *                 on the head). These are NOT the same — do not "align" them.
 * - `alphaCap`  — peak alpha of the head pixel: L2 `SHOOTER_ALPHA_CAP`, L1 the meteor's
 *                 own (dimmer) `alpha`.
 */
export type StepOpts = {
  width: number;
  y0Scale: number;
  slopeFrame: "absolute" | "head-relative";
  alphaCap: number;
};

/**
 * Per-frame stepping for ONE meteor at time `sec` (seconds): the list of tail pixels
 * to draw, or `[]` during the long pause. This is the math both `GalaxyBackdrop` (L2)
 * and `DeepStarfield` (L1) used to inline in their `draw()` loops — extracted verbatim
 * so it is unit-testable in node, with the four layer differences threaded through
 * `opts` (see `StepOpts`). The components now only iterate the result and issue
 * `fillRect`s; the rendered output is byte-identical.
 *
 * Behavior preserved exactly, including the deliberate per-layer slope-frame asymmetry
 * and the `Math.round` on the final x/y (y is computed from the *raw* float x, then
 * rounded — matching the old inline code).
 */
export const stepMeteor = (
  m: Steppable,
  sec: number,
  opts: StepOpts,
): TailPixel[] => {
  const prog = ((sec + m.offset) / m.period) % 1;
  if (prog > STREAK_WINDOW) return []; // brief streak, long pause
  const head = meteorHeadX(m, prog / STREAK_WINDOW, opts.width);
  const fade = 1 - prog / STREAK_WINDOW;
  const y0 = m.y0 * opts.y0Scale;
  const pixels: TailPixel[] = [];
  for (let k = 0; k < m.len; k++) {
    const x = head - m.dir * k; // raw float; tail trails BEHIND the head
    const yRaw =
      opts.slopeFrame === "absolute"
        ? y0 + x * m.slope // stage-absolute (L2)
        : y0 + (x - head) * m.slope; // head-relative (L1)
    pixels.push({
      x: Math.round(x),
      y: Math.round(yRaw),
      alpha: (1 - k / m.len) * fade * opts.alphaCap,
    });
  }
  return pixels;
};
