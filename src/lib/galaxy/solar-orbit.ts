/**
 * Pure orbital-motion math for the Solar-System tier (ADR-0016, S3).
 *
 * Everything here is **pure + SSR-safe** (no GSAP, no DOM, no module-scope
 * clock, no Math.random). GSAP / RAF owns the time domain (ADR-0009); it
 * passes `t` (elapsed seconds) into these functions which return the current
 * render state. The component wires the output to DOM or canvas.
 *
 * Orbit speed model: loosely Keplerian (inner planets faster), but scaled
 * for visual pleasure rather than survey accuracy. A full outer-planet lap
 * takes ~60 s; inner planets are ~2–4× faster. The `placement.angle` in
 * `realdata.ts` is the authored static angle (SSR rest pose); the runtime
 * angle adds the orbital drift on top.
 *
 * Reduced motion: the caller passes `reducedMotion:true` and all functions
 * return the authored static angle from `realdata.ts` — no drift, no pulse.
 */

import type { RealObject } from "#/lib/galaxy/types";

const TAU = Math.PI * 2;

/**
 * Base angular speed (rad/s) for the innermost ring (r = 0.24).
 * One full orbit every ~120 s for Mercury — a calm, barely-there ambient drift
 * (owner: the orbits were "really fast"). Outer planets are far slower still.
 * The owner-tunable knob for overall orbit speed.
 */
export const ORBIT_BASE_SPEED = TAU / 120;

/**
 * Keplerian exponent for the speed fall-off with orbital radius.
 * Real Kepler's 3rd law: T ∝ r^1.5 → speed ∝ r^-0.75.
 * We use 0.85 (slightly shallower) so outer planets still visibly move.
 */
export const ORBIT_KEPLER_EXP = 0.85;

/**
 * The innermost planet's normalised ring radius (Mercury's `placement.r`).
 * Used as the reference to make inner speeds match ORBIT_BASE_SPEED.
 */
const INNER_RNORM = 0.24;

/**
 * Angular speed (rad/s) for a planet at normalised ring radius `r`.
 * Outer planets are slower (loosely Keplerian): `ω ∝ r^(-ORBIT_KEPLER_EXP)`.
 * Deterministic, pure, SSR-safe — no clock at module scope.
 */
export const orbitSpeed = (r: number): number =>
  ORBIT_BASE_SPEED * (INNER_RNORM / r) ** ORBIT_KEPLER_EXP;

/**
 * The current orbital angle (rad) for a planet at time `t` (elapsed seconds).
 * Wraps at TAU (deterministic, no discontinuity). Starts from the planet's
 * authored `placement.angle` (the static rest pose for SSR + reduced motion).
 *
 * `reducedMotion` → returns the static authored angle (no drift).
 */
export const orbitAngle = (
  planet: RealObject,
  t: number,
  reducedMotion = false,
): number => {
  if (reducedMotion) return planet.placement.angle;
  const speed = orbitSpeed(planet.placement.r);
  return (planet.placement.angle + speed * t) % TAU;
};

/**
 * Stage-space (cx, cy) for a planet at angle `theta` on its ring.
 * Mirrors the design's `ringXY()` function. SOLAR_RX and SOLAR_TILT are
 * the canonical render constants from `galaxy-render.ts` — they're re-exported
 * here (from a sibling pure module) so `solar-orbit.ts` stays GSAP-free and
 * testable without importing the render module.
 */
export const SOLAR_ORBIT_RX = 440; // px at normalised r = 1 (SOLAR_RX in galaxy-render.ts)
export const SOLAR_ORBIT_TILT = 0.58; // ecliptic foreshortening (SOLAR_TILT)

export const ringXY = (
  r: number,
  theta: number,
  cx: number,
  cy: number,
): { x: number; y: number } => ({
  x: cx + Math.cos(theta) * r * SOLAR_ORBIT_RX,
  y: cy + Math.sin(theta) * r * SOLAR_ORBIT_RX * SOLAR_ORBIT_TILT,
});

// ── Sun pulse (S2 animation character, spec §"Sun pulse character") ──────────

/**
 * Sun pulse period (s) — one full breath (in → out → in).
 * Owner-tunable knob; spec mandates ~7 s, calm and reverent.
 */
export const SUN_PULSE_PERIOD = 7;

/**
 * Photosphere scale amplitude — the disk swells ±2.2% at peak breath.
 * `scale(1) ↔ scale(1.022)`.
 */
export const SUN_PULSE_SCALE_AMPLITUDE = 0.022;

/**
 * Corona opacity range — dims to 0.5 at rest, swells to 0.85 at peak.
 */
export const SUN_CORONA_OPACITY_MIN = 0.5;
export const SUN_CORONA_OPACITY_MAX = 0.85;

/**
 * Corona scale range — contracts to 0.95, expands to 1.06 at peak.
 */
export const SUN_CORONA_SCALE_MIN = 0.95;
export const SUN_CORONA_SCALE_MAX = 1.06;

/**
 * Photosphere disk scale at time `t` (elapsed seconds).
 * Returns `1 + SUN_PULSE_SCALE_AMPLITUDE * sin(2π·t/period)` — a gentle
 * swell using ease-in-out (approximated by sin; GSAP will ease it).
 *
 * `reducedMotion` → returns 1.0 (static, mid-breath).
 */
export const sunPhotosphereScale = (
  t: number,
  reducedMotion = false,
): number => {
  if (reducedMotion) return 1;
  const phase = (TAU * t) / SUN_PULSE_PERIOD;
  return 1 + SUN_PULSE_SCALE_AMPLITUDE * Math.sin(phase);
};

/**
 * Corona opacity at time `t`. Breathes between MIN and MAX in sync with
 * the photosphere scale.
 *
 * `reducedMotion` → returns the mid/at-rest value (~0.8).
 */
export const sunCoronaOpacity = (t: number, reducedMotion = false): number => {
  if (reducedMotion) return 0.8;
  const phase = (TAU * t) / SUN_PULSE_PERIOD;
  const norm = (1 + Math.sin(phase)) / 2; // 0..1
  return (
    SUN_CORONA_OPACITY_MIN +
    norm * (SUN_CORONA_OPACITY_MAX - SUN_CORONA_OPACITY_MIN)
  );
};

/**
 * Corona CSS transform scale at time `t`.
 *
 * `reducedMotion` → returns 1.0 (static).
 */
export const sunCoronaScale = (t: number, reducedMotion = false): number => {
  if (reducedMotion) return 1;
  const phase = (TAU * t) / SUN_PULSE_PERIOD;
  const norm = (1 + Math.sin(phase)) / 2; // 0..1
  return (
    SUN_CORONA_SCALE_MIN + norm * (SUN_CORONA_SCALE_MAX - SUN_CORONA_SCALE_MIN)
  );
};

// ── Per-planet visual cue descriptors (S2 — pure, testable) ──────────────────

/**
 * The one recognizable cue per planet (design spec §per-planet-cue table).
 * Pure data — keyed by planet id, describes WHAT to render (the component
 * reads these to apply CSS / overlay elements). Not pixel-art, not photorealistic —
 * one clean differentiating feature per planet.
 */
export type PlanetCue =
  | { kind: "bare" } // Mercury — bare grey rock, no cue
  | { kind: "haze" } // Venus — smooth cream cloud shroud
  | { kind: "marble"; swirl: boolean } // Earth — blue marble + cloud swirl + rim
  | { kind: "polarCap" } // Mars — rust sphere + tiny polar cap
  | { kind: "bands"; hasSpot: boolean } // Jupiter — cloud bands + Great Red Spot
  | { kind: "ring"; tilt: number } // Saturn — tilted ring
  | { kind: "smooth" } // Uranus — featureless pale-cyan ice ball
  | { kind: "storm" }; // Neptune — deep-blue with dark mottling

/** Per-planet visual cue descriptor, keyed by planet id. */
export const PLANET_CUES = {
  mercury: { kind: "bare" },
  venus: { kind: "haze" },
  earth: { kind: "marble", swirl: true },
  mars: { kind: "polarCap" },
  jupiter: { kind: "bands", hasSpot: true },
  saturn: { kind: "ring", tilt: SOLAR_ORBIT_TILT },
  uranus: { kind: "smooth" },
  neptune: { kind: "storm" },
} as const satisfies Record<string, PlanetCue>;

/** The planet's signature colour (design spec §per-planet table). */
export const PLANET_COLORS = {
  mercury: "#b0c2bc",
  venus: "#e8d8b8",
  earth: "#9cc8e8",
  mars: "#d8a890",
  jupiter: "#cbb8a8",
  saturn: "#d8c89c",
  uranus: "#9cd8d0",
  neptune: "#8aa0d8",
} as const satisfies Record<string, string>;
