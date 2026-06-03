/**
 * Pure, seeded point geometry for the procedural backdrop disk (#4) — the
 * headless half of the canvas `GalaxyBackdrop` component. Recreates the
 * prototype's *output* (`galaxy.jsx` `PixelGalaxy`), reworked per the design
 * spec: a cleaner barred log-spiral with two bright primary arms and two faded
 * secondary ones (`docs/design/2026-06-02-explorable-galaxy.md` §"GalaxyBackdrop
 * rework").
 *
 * Everything is a deterministic function of `backdrop.seed` (mulberry32), so the
 * same seed yields byte-identical pixels (#4 AC) and SSR/client never disagree.
 * `palette` is intentionally NOT read here — it only tints color downstream; the
 * geometry it produces is identical across palettes.
 */

import {
  DISK_TILT,
  GALAXY_CENTER,
  GALAXY_R,
  STAGE_H,
  STAGE_W,
} from "#/lib/galaxy/place";
import { mulberry32 } from "#/lib/galaxy/rng";
import type { GalaxyBackdrop } from "#/lib/galaxy/types";

/** One drawn pixel: position, crisp size, base brightness, and animation seeds. */
export type BackdropPoint = {
  x: number;
  y: number;
  size: 1 | 2;
  alpha: number; // base brightness 0..1
  phase: number; // 0..1 twinkle phase (the live overlay animates; geometry stays pure)
  warm: number; // 0..1 cool→warm tint mix, resolved against the palette by the canvas
};

/** The four structural point clouds the canvas paints back-to-front. */
export type BackdropGeometry = {
  bgStars: BackdropPoint[]; // faint full-stage field
  arms: BackdropPoint[]; // log-spiral arms
  bar: BackdropPoint[]; // central bar @ 25°
  bulge: BackdropPoint[]; // bright core cloud
};

const TAU = Math.PI * 2;
const BAR_ANGLE = (25 * Math.PI) / 180;
const ARM_WIND = 1.8; // log-spiral winding: theta = base + ln(r/startR) * ARM_WIND
const START_R = 0.12; // inner radius where the arms begin

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Disk-polar (rNorm 0..1, theta rad) → stage pixels, foreshortened by the tilt. */
const toStage = (rNorm: number, theta: number): { x: number; y: number } => {
  const rr = rNorm * GALAXY_R;
  return {
    x: GALAXY_CENTER.x + Math.cos(theta) * rr,
    y: GALAXY_CENTER.y + Math.sin(theta) * rr * DISK_TILT,
  };
};

const pointAt = (
  rNorm: number,
  theta: number,
  rng: () => number,
  alpha: number,
  warm: number,
  bigChance: number,
): BackdropPoint => {
  const p = toStage(rNorm, theta);
  return {
    x: clamp(Math.round(p.x), 0, STAGE_W),
    y: clamp(Math.round(p.y), 0, STAGE_H),
    size: rng() < bigChance ? 2 : 1,
    alpha,
    phase: rng(),
    warm,
  };
};

export const buildBackdropGeometry = (
  backdrop: GalaxyBackdrop,
): BackdropGeometry => {
  const { seed, branches, spin, randomnessPower } = backdrop;

  // Independent streams per layer (xor-folded seed) so tuning one layer's count
  // never reshuffles another.
  const bgRng = mulberry32(seed ^ 0x9e3779b9);
  const armRng = mulberry32(seed);
  const barRng = mulberry32(seed ^ 0x85ebca6b);
  const bulgeRng = mulberry32(seed ^ 0xc2b2ae35);

  const bgStars: BackdropPoint[] = [];
  for (let i = 0; i < 220; i++) {
    bgStars.push({
      x: Math.round(bgRng() * STAGE_W),
      y: Math.round(bgRng() * STAGE_H),
      size: bgRng() < 0.12 ? 2 : 1,
      alpha: 0.12 + bgRng() * 0.3,
      phase: bgRng(),
      warm: bgRng(),
    });
  }

  const arms: BackdropPoint[] = [];
  for (let arm = 0; arm < branches; arm++) {
    const primary = arm % 2 === 0; // alternate bright / faded arms
    const armBase = (arm / branches) * TAU;
    const count = primary ? 260 : 110;
    const spread = primary ? 0.16 : 0.3; // tighter primaries read more clearly
    const fade = primary ? 1 : 0.55;
    for (let i = 0; i < count; i++) {
      const rNorm = START_R + (1 - START_R) * armRng() ** 0.9;
      const theta =
        armBase +
        Math.log(rNorm / START_R) * ARM_WIND * spin +
        (armRng() - 0.5) * spread;
      arms.push(
        pointAt(
          rNorm,
          theta,
          armRng,
          (0.3 + armRng() * 0.5) * fade,
          0.4 + armRng() * 0.6,
          0.1,
        ),
      );
    }
  }

  const bar: BackdropPoint[] = [];
  for (let i = 0; i < 120; i++) {
    const t = barRng() * 2 - 1; // -1..1 along the bar axis
    const rNorm = Math.abs(t) * 0.42;
    const theta = BAR_ANGLE + (t < 0 ? Math.PI : 0) + (barRng() - 0.5) * 0.12;
    bar.push(
      pointAt(
        rNorm,
        theta,
        barRng,
        0.35 + barRng() * 0.45,
        0.5 + barRng() * 0.5,
        0.15,
      ),
    );
  }

  const bulge: BackdropPoint[] = [];
  for (let i = 0; i < 160; i++) {
    const rNorm = bulgeRng() ** randomnessPower * 0.22; // power-biased toward the core
    const theta = bulgeRng() * TAU;
    bulge.push(
      pointAt(
        rNorm,
        theta,
        bulgeRng,
        0.4 + bulgeRng() * 0.55,
        0.6 + bulgeRng() * 0.4,
        0.2,
      ),
    );
  }

  return { bgStars, arms, bar, bulge };
};
