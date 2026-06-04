/**
 * ASTRO's speech bubble (#72) — the mascot's a11y surface. ASTRO is decorative
 * pixel-art (the sprite stays `aria-hidden`); the *words* carry meaning, so the
 * bubble text lives in a polite live region — the semantic `<output>` element,
 * whose implicit `role="status"` + `aria-live="polite"` is exactly the contract
 * the story names (and what Biome's `useSemanticElements` prefers over a bare
 * `<div role="status">`). It announces the auto-greet on mount and each
 * re-spoken click line.
 *
 * Soft-glow chrome, NOT pixel-art (the style rule: DOM chrome = soft glow). The
 * panel is a glass surface — dark translucent bg, `backdrop-filter: blur`, a 1px
 * amber accent border, serif italic body — with a ▽ tail pointing down at ASTRO.
 * It docks above the sprite inside `.galaxy-astro`, so it inherits ASTRO's stage
 * scale, `z-index`, and the ≤720px hide (the bubble is tied to ASTRO's visibility).
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
  <output
    className="galaxy-astro__bubble pointer-events-auto"
    aria-live="polite"
  >
    <p className="galaxy-astro__bubble-text">{message}</p>
    <button
      type="button"
      className="galaxy-astro__bubble-dismiss"
      aria-label="dismiss"
      onClick={onDismiss}
    >
      ×
    </button>
  </output>
);
