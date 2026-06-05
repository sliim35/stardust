/**
 * ASTRO's speech bubble (#72) — the mascot's a11y surface. ASTRO is decorative
 * pixel-art (the sprite stays `aria-hidden`); the *words* carry meaning, so the
 * spoken line lives in a polite live region — a semantic `<output>` (implicit
 * `role="status"` + `aria-live="polite"`, the contract the story names, and what
 * Biome's `useSemanticElements` prefers over a bare `<div role="status">`). It
 * announces the auto-greet on mount and each re-spoken click line.
 *
 * The live region wraps ONLY the text. The dismiss control is a *sibling* of the
 * `<output>`, deliberately OUTSIDE the live region, so assistive tech never
 * announces "dismiss" as part of the spoken line (ARIA APG: keep interactive
 * controls out of live regions). The panel `<div>` is the positioned chrome host;
 * the dismiss button is absolutely placed within it (top-right) — visually
 * unchanged.
 *
 * Soft-glow chrome, NOT pixel-art (the style rule: DOM chrome = soft glow). The
 * panel is a WINDOW CUT INTO THE VOID, not a boxed amber callout (owner critique
 * #2a): `--color-surface` translucent bg + soft `backdrop-filter: blur`, a faint
 * hairline, and a single 2px LEFT-only accent rule (a quoted-passage feel) — amber
 * is spent once, never as a glowing ring that out-shouts Sol. The body is the memory
 * voice — serif italic, lower-case (#2b). A neutral stem tethers it toward ASTRO's
 * corner. It docks above the sprite inside `.galaxy-astro`, so it inherits ASTRO's
 * stage scale, `z-index`, and the ≤720px hide (the bubble is tied to ASTRO's
 * visibility).
 *
 * Draw-only: the copy + the line-rotation rule live in the pure, unit-tested
 * `#/lib/galaxy/astro-voice` (the lib-pure rule). Entrance animation + the tail +
 * reduced-motion gate live in `.galaxy-astro__bubble*` CSS (src/styles.css).
 */

type Props = {
  /** The line ASTRO is currently speaking. */
  message: string;
  /** Hide the bubble (the dismiss control). */
  onDismiss: () => void;
};

export const AstroBubble = ({ message, onDismiss }: Props) => (
  <div className="galaxy-astro__bubble pointer-events-auto">
    <output className="galaxy-astro__bubble-text" aria-live="polite">
      {message}
    </output>
    <button
      type="button"
      className="galaxy-astro__bubble-dismiss"
      aria-label="dismiss"
      onClick={onDismiss}
    >
      ×
    </button>
  </div>
);
