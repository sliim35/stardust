import type { ReactNode } from "react";

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
 * panel is a glass surface — `--color-surface` translucent bg, `backdrop-filter:
 * blur`, a 1px amber accent border, serif italic body — with a ▽ tail pointing
 * down at ASTRO. It docks above the sprite inside `.galaxy-astro`, so it inherits
 * ASTRO's stage scale, `z-index`, and the ≤720px hide (the bubble is tied to
 * ASTRO's visibility).
 *
 * Draw-only: the copy + the line-rotation rule live in the pure, unit-tested
 * `#/lib/galaxy/astro-voice` (the lib-pure rule). Entrance animation + the tail +
 * reduced-motion gate live in `.galaxy-astro__bubble*` CSS (src/styles.css).
 */

type Props = {
  /** The line ASTRO is currently speaking. `null` while the bubble hosts only the form. */
  message?: string | null;
  /**
   * Extra surface below the spoken line — the quiet "Add your star" CTA, or the
   * `AstroComposer` form (#183 dir. A). Lives OUTSIDE the `<output>` live region so
   * assistive tech never announces the controls as part of the spoken line.
   */
  children?: ReactNode;
  /** Hide the bubble / cancel the form (the dismiss control). */
  onDismiss: () => void;
};

export const AstroBubble = ({ message = null, children, onDismiss }: Props) => (
  <div className="galaxy-astro__bubble pointer-events-auto">
    {/* Speaker tag — identifies ASTRO as the author of the bubble so the tail
        tether reads as "spoken by". Mono eyebrow style, accent colour. */}
    <span className="galaxy-astro__bubble-tag" aria-hidden="true">
      ASTRO
    </span>
    {message != null && (
      <output className="galaxy-astro__bubble-text" aria-live="polite">
        {message}
      </output>
    )}
    {children}
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
