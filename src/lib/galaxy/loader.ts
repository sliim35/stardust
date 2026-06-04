/**
 * Pure, headless model for the ASTRO loading screen (#79) — the lib-pure half of
 * the loader, recreated from the Claude Design handoff `astro/Loader.html` (output
 * recreated fresh per ADR-0002 §2, never copied). All timing/curve/layout values
 * that the CSS keyframes and the `AstroLoader` component consume live here once and
 * are unit-tested in node — no DOM/`window` access, so it is SSR/Workers-safe.
 *
 * The loader backdrop reuses `generateStars` from `src/lib/starfield.ts` (the DRY
 * rule — `mulberry32` is never re-implemented); this module only adds the pure,
 * deterministic *color tiering* the handoff applied per star, derived from the
 * star's own fields so no extra RNG draw is needed.
 */

import type { Star } from "#/lib/starfield";

/* ── timing constants — one number per CSS @keyframes (pinned by loader.test.ts) ── */

/** ASTRO bob cycle — `astro-loader-bob 4s` (styles.css). */
export const BOB_CYCLE_MS = 4000;
/** ASTRO secondary drift cycle — `astro-loader-drift 9s`. */
export const DRIFT_CYCLE_MS = 9000;
/** Thinking-dot blink cycle — `astro-loader-blink 1.4s`. */
export const BLINK_CYCLE_MS = 1400;
/** Progress sweep cycle — `astro-loader-sweep 2.2s`. */
export const SWEEP_CYCLE_MS = 2200;
/** Twinkle cycle for the fixed sparks/stars — `astro-loader-twinkle 2.2s`. */
export const TWINKLE_CYCLE_MS = 2200;

/** Stagger delays for the three blinking "thinking…" dots (handoff: 0/200/400ms). */
export const DOT_DELAYS_MS = [0, 200, 400] as const;

/** Default sub-label copy when no `label` prop is supplied. */
export const DEFAULT_LABEL = "gathering her stars";

/** Fade-out transition once `onReady` fires — `transition: opacity 0.4s ease`. */
export const FADE_MS = 400;

/**
 * Static partial fill (0..1) the sweep track shows under `prefers-reduced-motion`
 * instead of animating — the handoff's reduced `width:38%` rest state.
 */
export const REDUCED_SWEEP_FILL = 0.38;

/* ── seeded starfield (reuses generateStars; mulberry32 is NOT re-implemented) ── */

/** Handoff seed (`mulberry32(7777)`) — the same loading sky every render. */
export const LOADER_STARFIELD_SEED = 7777;
/** Star count is the viewport area over this divisor (handoff `w*h/9000`). */
export const STARFIELD_DIVISOR = 9000;

/** The three handoff color tiers a backdrop star can fall into. */
export type StarTier = "accent" | "cool" | "dim";

/**
 * Star count for a `w×h` viewport — `round(w*h/divisor)`, clamped at 0 so an
 * unmeasured / zero viewport yields an empty (not negative) field.
 */
export const starCountFor = (
  width: number,
  height: number,
  divisor = STARFIELD_DIVISOR,
): number => {
  // Clamp each dimension at 0 first — two negatives would otherwise multiply to a
  // positive area and seed a nonsensical field for an unmeasured viewport.
  const area = Math.max(0, width) * Math.max(0, height);
  return Math.round(area / divisor);
};

/**
 * Map a `generateStars` star to one of the handoff's three color tiers, purely and
 * deterministically. The handoff drew a separate `rnd()` per star to tier it; here
 * we reuse the star's own `alpha` (a fresh RNG draw inside `generateStars`) as the
 * tier key — same deterministic sky, no second RNG, `generateStars` reused intact.
 * Brightest are amber `accent`; a middle band is `cool` blue-grey; the rest are the
 * faint `dim` field — a `>0.94 / >0.6 / else` split. The amber cutoff is deliberately
 * widened from the handoff's `>0.97` to `>0.94` so a few more stars catch the ember
 * accent (the loader's pre-galaxy sky reads warmer); the lower bands are unchanged.
 */
export const starColorTier = (star: Star): StarTier => {
  if (star.alpha > 0.94) return "accent";
  if (star.alpha > 0.6) return "cool";
  return "dim";
};

/* ── fixed twinkling pixel accents around the stage (handoff layout) ── */

/** A fixed twinkling pixel accent: position (integer px), token color, delay. */
export type LoaderAccent = {
  left: number;
  top: number;
  color: string;
  delayMs: number;
  /** Optional per-accent twinkle duration override (handoff varies a few). */
  durationMs?: number;
};

/**
 * The three `.spark` accents (cross-shaped twinkles) at the handoff's fixed stage
 * positions + stagger delays. Colors map to galaxy tokens: the accent thread, the
 * bright core, and the cool star — no raw hex (the token rule, #75/#6).
 */
export const LOADER_SPARKS = [
  { left: 34, top: 30, color: "var(--color-accent)", delayMs: 0 },
  {
    left: 120,
    top: 20,
    color: "var(--color-text-bright)",
    delayMs: 900,
    durationMs: 3000,
  },
  { left: 130, top: 66, color: "var(--color-dim)", delayMs: 1700 },
] as const satisfies readonly LoaderAccent[];

/** The four `.star` accents (single-pixel twinkles) at the handoff positions. */
export const LOADER_STARS = [
  { left: 24, top: 58, color: "var(--color-text-bright)", delayMs: 500 },
  {
    left: 78,
    top: 6,
    color: "var(--color-accent)",
    delayMs: 1300,
    durationMs: 2600,
  },
  { left: 126, top: 42, color: "var(--color-dim)", delayMs: 2000 },
  {
    left: 30,
    top: 14,
    color: "var(--color-accent)",
    delayMs: 760,
    durationMs: 3000,
  },
] as const satisfies readonly LoaderAccent[];
