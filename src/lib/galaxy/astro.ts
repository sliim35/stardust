/**
 * Pure, headless model for the ASTRO mascot sprite (#70) — the canonical
 * STARLIGHT `idle` pose recreated from the Claude Design handoff `astro/mascots.js`
 * (`ASTRO.poses.idle` + `ASTRO.palette`). Per ADR-0002 §2 the *output* is recreated
 * fresh here, never imported/copied from the gitignored `astro/` handoff.
 *
 * This is the lib-pure half of the sprite (mirrors the meteors refactor #55): the
 * char-grid → typed `{x,y,color}` cell list lives here and is unit-tested in node,
 * while `PixelAstronaut.tsx` stays draw-only (it maps the cell list to DOM divs).
 * No canvas/DOM here, so it is SSR/Workers-safe and deterministic.
 *
 * The sprite is intentionally **hard pixel art** (a figurative mascot, the same
 * category as the cosmos canvas) — a documented divergence from the "DOM chrome =
 * soft glow" rule, contained to the figure (design spec §"Style-tension resolution").
 */

/** The fixed sprite grid: 16×16 cells (one bounding box for every pose). */
export const ASTRO_GRID_SIZE = 16;

/** Logical px per cell — 16 × 4 = the 64×64 stage-px bounding box (prototype scale). */
export const DEFAULT_CELL_PX = 4;

/** The grid marker that paints nothing (the figure floats on transparency). */
export const ASTRO_TRANSPARENT = ".";

/** Palette key for the visor-glow cells — the one bright accent pixel cluster. */
export const ASTRO_VISOR_GLOW_KEY = "V";
/** Palette key for the chest/waist trim cells — the single amber accent stripe. */
export const ASTRO_TRIM_KEY = "t";

/**
 * The canonical STARLIGHT `idle` pose — both arms relaxed, weightless float; the
 * resting pose ASTRO holds ~95% of the time. Recreated cell-for-cell from
 * `astro/mascots.js` `ASTRO.poses.idle` (the design's ground truth), authored here
 * fresh as a `const` literal. `.` = transparent; every other char is a palette key.
 */
export const ASTRO_IDLE = [
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "....hVVvvvvh....",
  "....hVvvvvvh....",
  "....hvvvvvvh....",
  "....hhhhhhhh....",
  ".....ssssss.....",
  "....asttttsap...",
  "....assssssap...",
  "....asttttsa....",
  "....gssssssg....",
  ".....ssssss.....",
  ".....ss..ss.....",
  ".....bb..bb.....",
  "....bbb..bbb....",
  "................",
] as const;

/**
 * Palette key → sprite "part" role. Neutral materials (`--astro-*` tokens) plus the
 * two accent keys (`V` visor-glow + `t` trim) that track the live accent. The suit
 * body `s` and arm `a` share the same near-white material. Mirrors the handoff palette
 * legend; the concrete hex resolution lives in the component (token-colored).
 */
export const ASTRO_PALETTE = {
  h: "helmet",
  v: "visor",
  V: "accent", // visor-glow — the live accent (amber)
  s: "suit",
  t: "accent", // chest/waist trim — the live accent (amber)
  g: "glove",
  p: "pack",
  b: "boot",
  a: "suit", // arms share the suit material
} as const satisfies Record<string, AstroPart>;

/** The material/role a sprite cell paints with (neutral parts + the themed accent). */
export type AstroPart =
  | "helmet"
  | "visor"
  | "accent"
  | "suit"
  | "glove"
  | "pack"
  | "boot";

/** Every palette key the grids may use (for grid validation + char allow-listing). */
export const ASTRO_PALETTE_KEYS = Object.keys(
  ASTRO_PALETTE,
) as readonly (keyof typeof ASTRO_PALETTE)[];

/** A single painted cell: integer grid coordinates + the resolved fill color. */
export type SpriteCell = { x: number; y: number; color: string };

/**
 * Parse a char-grid into a flat, row-major list of painted cells. `.` (and any char
 * the resolver can't color) is skipped, so the figure floats on transparency. The
 * resolver maps a palette key → a concrete CSS color (or `null`/`undefined` to drop
 * the cell, e.g. an unknown char), keeping this module free of token/DOM concerns.
 *
 * Deterministic: a given grid + resolver always yields the same cells in the same
 * order (y outer, x inner), so SSR and the client never disagree.
 */
export const parseSprite = (
  grid: readonly string[],
  resolve: (key: string) => string | null | undefined,
): SpriteCell[] => {
  const cells: SpriteCell[] = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ASTRO_TRANSPARENT) continue;
      const color = resolve(ch);
      if (color == null) continue; // unknown char → transparent, never magenta
      cells.push({ x, y, color });
    }
  }
  return cells;
};

/** The idle-bob cycle: ~4000ms ease-in-out, infinite (CSS owns the easing). */
export const BOB_CYCLE_MS = 4000;
/** Peak upward float at the midpoint, in stage px (negative = up). */
export const BOB_PEAK_TRANSLATE_PX = -6;
/** Peak tilt at the midpoint, in degrees (spec canonical: the -1/-2 average). */
export const BOB_PEAK_ROTATE_DEG = -1.5;

/** The optional secondary drift cycle (~9000ms) — polish, may be deferred to #71. */
export const DRIFT_CYCLE_MS = 9000;

/** The bob transform at a given cycle phase. */
export type BobTransform = { translateY: number; rotate: number };

/**
 * The bob curve at normalized cycle phase `t` (0..1): a single triangular rise to the
 * peak at the midpoint and back, matching the two-stop CSS `@keyframes astro-bob`
 * (`0%/100% → rest`, `50% → peak`). CSS does the real ease-in-out interpolation at
 * runtime; this pure form exists so the timing/curve is unit-testable and the keyframe
 * constants have one source of truth. Never bounces, never springs (the brand rule).
 */
export const bobTransform = (t: number): BobTransform => {
  const tri = 1 - Math.abs(2 * t - 1); // 0 at t=0/1, 1 at t=0.5
  // `+ 0` normalizes the signed zero from `-6 * 0` so rest is exactly { 0, 0 }.
  return {
    translateY: BOB_PEAK_TRANSLATE_PX * tri + 0,
    rotate: BOB_PEAK_ROTATE_DEG * tri + 0,
  };
};
