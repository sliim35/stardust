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
 * Wide-panel redesign (2026-06-25): the bubble is now a BORDERLESS text section
 * INSIDE the wide `.galaxy-astro__panel` glass surface — the panel owns the
 * soft-glow chrome (bg/blur/border/glow). The bubble renders the left-aligned
 * spoken line + the dismiss ×. The ASTRO speaker tag + the ▽ tail moved up to the
 * panel (`.galaxy-astro__panel`, top-right) so the tail points at the sprite that
 * stands at the panel's bottom-right edge — ASTRO visibly speaks the panel.
 *
 * Draw-only: the copy + the line-rotation rule live in the pure, unit-tested
 * `#/lib/galaxy/astro-voice` (the lib-pure rule). Entrance animation + the tail +
 * reduced-motion gate live in `.galaxy-astro*` CSS (src/styles.css).
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
