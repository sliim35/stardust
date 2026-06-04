/**
 * Pure, headless voice model for ASTRO (#72) — the copy ASTRO speaks and the
 * deterministic rule for which line a click shows next. The component half
 * (`AstroBubble` + the `Astro` wiring) stays draw-only; this module is the
 * lib-pure, unit-tested seam (mirrors `astro.ts` for the sprite).
 *
 * Deterministic by design: `nextClickLine` is a pure rotation (never random),
 * so SSR and the client never disagree and the rotation is fully unit-testable.
 * No DOM, no `Math.random`, no time — SSR/Workers-safe.
 */

/**
 * The confirmed opening line ASTRO auto-greets with on mount (AC2). Lowercase,
 * wistful voice; the em dash + "i'll" carry ASTRO's first-person host tone.
 */
export const ASTRO_GREETING =
  "every star here is a memory someone left behind. the pulsing one is hers — but add your own, and i'll find its place." as const;

/**
 * The small set of lines ASTRO re-speaks on click (AC3). Lowercase, wistful;
 * each is distinct and none repeats the greeting. Rotated through in order by
 * `nextClickLine` so every click shows a fresh line.
 */
export const ASTRO_CLICK_LINES = [
  "every light you see used to be someone's warmth.",
  "i've been here a long time. so have they.",
  "add a star. i'll find it a good place in the sky.",
  "some stars pulse a little brighter. those are the ones most loved.",
  "the sky keeps growing. it always does.",
] as const;

/**
 * The click line to show next, given the currently-displayed message. A pure,
 * deterministic rotation through `ASTRO_CLICK_LINES`:
 * - no previous (mount/greeting/unknown) → the first click line;
 * - a known click line → the next one, wrapping at the end.
 *
 * Never returns the same line twice in a row, so every click visibly changes
 * the bubble. Deterministic (no randomness/time) → SSR and client agree.
 */
export const nextClickLine = (prev: string | null | undefined): string => {
  const i =
    prev == null ? -1 : (ASTRO_CLICK_LINES as readonly string[]).indexOf(prev);
  // -1 (unknown/greeting/none) → first line; otherwise advance + wrap.
  const next = (i + 1) % ASTRO_CLICK_LINES.length;
  return ASTRO_CLICK_LINES[next];
};
