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

/**
 * The galaxy host ASTRO's render scale — the single size knob for the corner
 * mascot (16 × 7 = a 112×112 box). Bigger than the prototype default so it sits
 * with the decoupled speech bubble beside it instead of reading tiny; the owner
 * fine-tunes the exact size from the preview by changing only this number. The
 * loader keeps its own `scale={6}` and #70's tests keep `DEFAULT_CELL_PX`.
 */
export const GALAXY_ASTRO_SCALE = 7;

/** The grid marker that paints nothing (the figure floats on transparency). */
export const ASTRO_TRANSPARENT = ".";

/** Palette key for the visor-glow cells — the one bright accent pixel cluster. */
export const ASTRO_VISOR_GLOW_KEY = "V";
/** Palette key for the chest/waist trim cells — the single amber accent stripe. */
export const ASTRO_TRIM_KEY = "t";

/** Palette key for a soft, level eye-light (pale amber) — the resting `calm` eyes. */
export const ASTRO_EYE_SOFT_KEY = "e";
/** Palette key for a bright eye-hotspot (warm cream) — `curious`/`happy` brighten here. */
export const ASTRO_EYE_BRIGHT_KEY = "E";
/** Palette key for a dim eye-glow (muted amber) — the `blink` dip + `tender` lids. */
export const ASTRO_EYE_DIM_KEY = "d";

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
  // expression-only eyes (#71) — three brightness levels of the live accent so the
  // glowing pixel-eyes track the sky like the visor-glow does. `e` = the live accent
  // (soft, level), `E` = a brightened hotspot, `d` = a dimmed glow (blink/tender).
  e: "accent", // soft, level eye-light → the live accent
  E: "eye-bright", // bright hotspot (curious/happy)
  d: "eye-dim", // dim eye-glow (blink dip + tender lids)
} as const satisfies Record<string, AstroPart>;

/** The material/role a sprite cell paints with (neutral parts + the themed accent). */
export type AstroPart =
  | "helmet"
  | "visor"
  | "accent"
  | "suit"
  | "glove"
  | "pack"
  | "boot"
  | "eye-bright"
  | "eye-dim";

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

/* ── ASTRO expressions (#71) — glowing pixel-eyes ──────────────────────────
 *
 * Six moods recreated (output, not code — ADR-0002 §2). The figure never moves
 * between moods: helmet, suit, gloves, boots, pack and the amber chest-trim are
 * pixel-identical everywhere — only the pair of eyes inside the navy `v` visor band
 * (rows 2–4 × cols 5–10) changes shape, height and brightness. That carries the
 * whole emotion. The visor is clean navy (the resting expression IS the eye-lights),
 * so these frames intentionally drop the #70 idle's fixed `V` pilot light.
 *
 * SOURCE OF TRUTH (owner-approved): the showcase
 * `stardust/project/Astro Expression Frames.html` — the six-mood "glowing
 * pixel-eyes" reference. Each mood's lit eye cells equal that file's `build()`
 * overrides EXACTLY (coordinates `[row, col, char]`, 0-indexed, painted over the
 * locked clean-navy visor band). All six moods — including `thinking` and
 * `tender` — are first-class showcase art (the earlier variant-A PNGs were the
 * previous, wrong reference and are superseded here).
 *
 * SHAPE comes from the showcase; the eye COLOR wiring is kept as-is and tracks the
 * live palette: `e` → the live accent (soft, level), `E` → a brightened hotspot,
 * `d` → a dimmed glow (blink + tender lids). The showcase renders a fixed amber, so
 * here the shapes match but the eyes are accent-colored (sky-tinted), not amber.
 *
 * Same 16×16 box, palette convention and anchor as `ASTRO_IDLE` — drop-in, no
 * position shift. Pure data: the component maps a mood → its grid via `parseSprite`.
 */

/** The owner-approved mood set (calm + blink ambient; the rest situational). */
export const ASTRO_MOODS = [
  "calm",
  "blink",
  "curious",
  "happy",
  "thinking",
  "tender",
] as const;

/** A single ASTRO expression mood. */
export type AstroMood = (typeof ASTRO_MOODS)[number];

/**
 * The locked emotion figure: identical to `ASTRO_IDLE` below the visor, with a
 * clean navy `v` visor band (no pilot light) so the eyes are the only expression.
 * Each mood overrides only the eye region (rows 2–4). Authored fresh as literals.
 */
export const ASTRO_FRAMES = {
  // SHOWCASE. calm = two soft level eye-lights. Overrides [3,6,e][3,9,e].
  calm: [
    ".....hhhhhh.....",
    "....hhhhhhhh....",
    "....hvvvvvvh....",
    "....hvevvevh....",
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
  ],
  // SHOWCASE. blink = eyes dim to a soft line. Overrides [3,6,d][3,7,d][3,8,d][3,9,d].
  blink: [
    ".....hhhhhh.....",
    "....hhhhhhhh....",
    "....hvvvvvvh....",
    "....hvddddvh....",
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
  ],
  // SHOWCASE. curious = tall, bright, wide-open. Overrides [2,6,E][3,6,E][2,9,E][3,9,E].
  curious: [
    ".....hhhhhh.....",
    "....hhhhhhhh....",
    "....hvEvvEvh....",
    "....hvEvvEvh....",
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
  ],
  // SHOWCASE. happy = symmetric ∧∧ upward squint.
  // Overrides [3,5,E][2,6,E][3,7,E][3,8,E][2,9,E][3,10,E].
  happy: [
    ".....hhhhhh.....",
    "....hhhhhhhh....",
    "....hvEvvEvh....",
    "....hEvEEvEh....",
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
  ],
  // SHOWCASE. thinking = drifted up & aside (recalling). Overrides [2,6,e][2,8,e].
  thinking: [
    ".....hhhhhh.....",
    "....hhhhhhhh....",
    "....hvevevvh....",
    "....hvvvvvvh....",
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
  ],
  // SHOWCASE. tender = half-lidded, downcast — dim `d` lids over soft `e` lights.
  // Overrides [3,6,d][3,9,d][4,6,e][4,9,e].
  tender: [
    ".....hhhhhh.....",
    "....hhhhhhhh....",
    "....hvvvvvvh....",
    "....hvdvvdvh....",
    "....hvevvevh....",
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
  ],
} as const satisfies Record<AstroMood, readonly string[]>;

/** The default resting mood ASTRO holds ~95% of the time. */
export const DEFAULT_MOOD: AstroMood = "calm";

/**
 * The situational moods a click rotates through, in order. `calm`/`blink` are
 * ambient and never click-triggered; this is the click vocabulary (curious →
 * happy → thinking → tender → wrap).
 */
export const CLICK_MOOD_CYCLE = [
  "curious",
  "happy",
  "thinking",
  "tender",
] as const satisfies readonly AstroMood[];

/**
 * The click mood to show next, given the currently-displayed mood. A pure,
 * deterministic rotation through `CLICK_MOOD_CYCLE` (mirrors `nextClickLine`):
 * - resting/ambient/unknown (`calm`/`blink`/`null`) → the first click mood;
 * - a known click mood → the next one, wrapping at the end.
 *
 * Never returns the same mood twice in a row, so every click visibly changes the
 * expression. Deterministic (no randomness/time) → SSR and client agree and it is
 * fully unit-testable.
 */
export const nextClickMood = (
  prev: AstroMood | null | undefined,
): AstroMood => {
  const i =
    prev == null
      ? -1
      : (CLICK_MOOD_CYCLE as readonly AstroMood[]).indexOf(prev);
  const next = (i + 1) % CLICK_MOOD_CYCLE.length;
  return CLICK_MOOD_CYCLE[next];
};

/** After a click emote, ASTRO settles back to `calm` after this long (~5 s). */
export const EMOTE_SETTLE_MS = 5000;

/** Idle-blink lower bound — the shortest gap between ambient blinks. */
export const BLINK_MIN_MS = 4000;
/** Idle-blink upper bound — the longest gap between ambient blinks. */
export const BLINK_MAX_MS = 8000;
/** How long the blink dip is held before the eyes reopen (~120 ms). */
export const BLINK_DIP_MS = 120;

/**
 * The next idle-blink delay, jittered across the 4–8 s window so the blink never
 * reads as a metronome. Takes an injected `rand` (a `() => number` in `[0,1)`,
 * default `Math.random`) so the timing is deterministic and unit-testable. Pure:
 * no clock, no DOM — the caller schedules the actual timer.
 */
export const nextBlinkDelay = (rand: () => number = Math.random): number =>
  BLINK_MIN_MS + rand() * (BLINK_MAX_MS - BLINK_MIN_MS);

/** What `startBlinkLoop` needs to drive the ambient blink (all injected). */
export type BlinkLoopOptions = {
  /** `() => number` in `[0,1)` for the jitter — default `Math.random`. */
  rand?: () => number;
  /** Whether ASTRO is at rest right now (only blink while resting on `calm`). */
  isResting: () => boolean;
  /** Called to dip the eyes to `blink`. */
  onBlink: () => void;
  /** Called ~120 ms later to reopen the eyes. */
  onReopen: () => void;
};

/**
 * Run the ambient idle-blink loop (AC1): wait a jittered 4–8 s, and — if ASTRO is
 * still resting — dip the eyes (`onBlink`), reopen them after `BLINK_DIP_MS`
 * (`onReopen`), then reschedule on a fresh jittered delay (never a metronome).
 *
 * Framework-free and clock-injectable (uses the ambient `setTimeout`/`clearTimeout`,
 * which vitest fake timers replace) so the timer behaviour is unit-testable. The
 * React shell (`useAstroFace`) just supplies the callbacks and the reduced-motion
 * gate. Returns a `stop()` that cancels any pending timers (effect cleanup).
 */
export const startBlinkLoop = (opts: BlinkLoopOptions): (() => void) => {
  const rand = opts.rand ?? Math.random;
  let scheduleTimer: ReturnType<typeof setTimeout>;
  let dipTimer: ReturnType<typeof setTimeout>;

  const schedule = (): void => {
    scheduleTimer = setTimeout(() => {
      if (opts.isResting()) {
        opts.onBlink();
        dipTimer = setTimeout(opts.onReopen, BLINK_DIP_MS);
      }
      schedule();
    }, nextBlinkDelay(rand));
  };
  schedule();

  return () => {
    clearTimeout(scheduleTimer);
    clearTimeout(dipTimer);
  };
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
