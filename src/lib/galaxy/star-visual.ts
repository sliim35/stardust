/**
 * Pure visual math for a memory star (#4) — the headless half of
 * `MemoryStarView`. Every rule the design spec pins to a number lives here so it
 * is unit-testable in node (`docs/design/2026-06-02-explorable-galaxy.md`
 * §"Bloom / flare / twinkle sizing", §"States"):
 *
 *  - bloom / flare / core sizing from `brightness`,
 *  - deterministic twinkle speed + phase derived from the star id (these are
 *    render-only and deliberately absent from the #2 data contract),
 *  - the egg's no-hover-label rule,
 *  - color pass-through — the agent owns `color`; the UI renders it verbatim.
 */

import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import type { MemoryStar, Mood } from "#/lib/galaxy/types";

/** Short mood labels for hover/eyebrow text (design spec mood table). */
export const MOOD_LABELS = {
  joyful: "joy",
  tender: "love",
  grieving: "grief",
  wistful: "longing",
  peaceful: "peace",
  nostalgic: "memory",
  wonder: "wonder",
} as const satisfies Record<Mood, string>;

export type BloomSizing = {
  bloom: number; // soft radial halo diameter (px)
  flareW: number; // horizontal lens-flare width
  vFlareH: number; // vertical lens-flare height
  hot: number; // white-hot center diameter
  core: number; // crisp core pixel size
};

/** Bloom / flare / core sizing for a star, optionally in its active (hover/selected) state. */
export const bloomSizing = (star: MemoryStar, active = false): BloomSizing => {
  const b = star.brightness;
  // Mom's star (the deep dedication star) reads unmistakably the biggest (spec §2).
  const base = star.egg ? 15 : (13 + b * 11) * (star.deep ? 1.2 : 1);
  const bloom = base * (active ? 1.3 : 1);
  const flareW = bloom * 2.5;
  return {
    bloom,
    flareW,
    vFlareH: flareW * 0.46,
    hot: bloom * 0.5,
    core: Math.max(2, 2 + b * 2),
  };
};

/**
 * Twinkle speed + phase for a star. Render-only, so derived deterministically
 * from the id (same star always twinkles the same way) rather than carried in
 * the data contract.
 */
export const animSeed = (id: string): { twinkle: number; phase: number } => {
  const rng = mulberry32(hashStr(id));
  return { twinkle: 0.6 + rng() * 1.8, phase: rng() };
};

export type TwinkleParams = {
  period: number; // seconds
  delay: number; // seconds
  kind: "twinkle" | "egg" | "deep";
};

/** Animation timing for a star — the slow egg pulse, or a calm derived twinkle. */
export const twinkleParams = (star: MemoryStar): TwinkleParams => {
  if (star.egg) return { period: 5.5, delay: 0, kind: "egg" };
  // Mom's star — a soft, slow breathe, not the busy twinkle and not a strong
  // cross-flare (interaction spec §2: toned down from the mockup).
  if (star.deep) return { period: 4.8, delay: 0, kind: "deep" };
  const { twinkle, phase } = animSeed(star.id);
  return {
    period: Math.max(1.4, 3.6 / twinkle),
    delay: phase * 0.3,
    kind: "twinkle",
  };
};

/** The hover label for a star — `null` for the egg, which stays anonymous (AC6). */
export const hoverLabelFor = (star: MemoryStar): string | null => {
  if (star.egg) return null;
  return star.name ?? MOOD_LABELS[star.mood];
};

/** The agent's color, untouched. The UI never recolors a star. */
export const starColor = (star: MemoryStar): string => star.color;

/** Soft radial halo gradient using the star color exactly (AC2). */
export const haloGradient = (color: string): string =>
  `radial-gradient(circle, ${color}bb 0%, ${color}30 32%, ${color}10 50%, transparent 68%)`;
