/**
 * Pure, headless rotation rule for ASTRO's re-speak lines (#72). The lines
 * themselves now live in the i18n catalog (`messages/*.astro`, localized in
 * #103), so ASTRO speaks the active locale. This module keeps only the
 * deterministic rule for WHICH line a click shows next — an **index**, not a
 * string, so the rotation is locale-agnostic (the same index addresses the en or
 * ru `clickLines` array; a Russian line never has to be looked up by value).
 *
 * Deterministic by design: a pure modular advance — no randomness, no time, no
 * DOM — so SSR and the client never disagree and the rule is fully unit-testable.
 * SSR/Workers-safe.
 */

/**
 * The index of the click line to show next, given the current one.
 * - `prev == null` (mount / showing the greeting / just dismissed) → `0`, the
 *   first click line, so the first click always advances off the greeting;
 * - otherwise advance one and wrap at `total`.
 *
 * `total` is the active locale's `clickLines.length`, passed in so this stays
 * pure with no catalog import. With `total > 1` it never returns `prev`, so every
 * click visibly changes the bubble.
 */
export const nextClickIndex = (prev: number | null, total: number): number =>
  prev == null ? 0 : (prev + 1) % total;
