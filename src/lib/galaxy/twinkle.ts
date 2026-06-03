/**
 * Pure twinkle/blink curves for the L1 deep starfield (`DeepStarfield`, #56).
 *
 * Spike #54 found the old field used `0.55 + 0.45·sin` for every star — a floor
 * of `0.10·alpha`, so nothing ever reached 0 and the deep field read as a fixed,
 * gently-breathing dot grid instead of sparkling.
 *
 * The fix splits the curve into three kinds:
 *  - `dim`     — the faint non-blinker **subset** flagged to blink. A **rectified,
 *                pow-shaped sine** (`max(0, sin θ)^k`): the whole negative half of
 *                the sine clamps to a **true 0** trough and the peak rises to
 *                **full 1**, so each star truly appears/disappears. Because every
 *                star carries its own phase, the troughs are staggered — only a
 *                small fraction are dark at any instant (no whole-field strobe).
 *  - `blinker` — the bright sharp accents. Keeps the **legacy** `0.55 + 0.45·sin`
 *                shimmer (band `0.10 .. 1.0`) so their crisp character is unchanged.
 *  - `shimmer` — every other (non-blinking) far star: a **shallow** breathing band
 *                that never falls dark, so the bulk of the field stays present and
 *                only the dim subset actually blinks out.
 *
 * Time-injected and stateless: the caller passes the phase angle `θ` (RAF time ×
 * seeded speed + seeded phase), so there is no module-scope `Date.now()` /
 * `Math.random()` and the helper is unit-testable in Node (ADR-0003).
 */

/** Trough/peak exponent for the rectified dim-star blink — >1 sharpens the spark. */
export const BLINK_POW = 2.2;

export type TwinkleKind = "blinker" | "dim" | "shimmer";

/**
 * Alpha multiplier in `[0, 1]` for a far star at phase angle `theta` (radians).
 *  - `blinker` → crisp legacy shimmer (`0.55 + 0.45·sin`, band `0.10 .. 1.0`),
 *  - `dim`     → rectified pow-shaped true-0 blink (`max(0, sin θ)^k`),
 *  - `shimmer` → shallow gentle breathing that never falls dark (`0.7 + 0.3·sin`).
 */
export const twinkleAlpha = (theta: number, kind: TwinkleKind): number => {
  if (kind === "blinker") return 0.55 + 0.45 * Math.sin(theta);
  if (kind === "shimmer") return 0.7 + 0.3 * Math.sin(theta);
  const s = Math.sin(theta);
  return s <= 0 ? 0 : s ** BLINK_POW;
};

/**
 * Pick a star's twinkle curve. Bright accents (`blinker`) stay crisp; otherwise
 * only the flagged dim **subset** truly blinks (`dim`) and the rest of the field
 * gently breathes (`shimmer`) so few stars are ever dark at once.
 */
export const kindFor = (blinker: boolean, blink: boolean): TwinkleKind =>
  blinker ? "blinker" : blink ? "dim" : "shimmer";
