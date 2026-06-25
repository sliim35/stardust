import type { ReactNode } from "react";

/**
 * ASTRO's speech bubble (#72) — the mascot's a11y surface. ASTRO is decorative
 * pixel-art (the sprite stays `aria-hidden`); the *words* carry meaning, so the
 * spoken line lives in a polite live region — a semantic `<output>` (implicit
 * `role="status"` + `aria-live="polite"`, the contract the story names, and what
 * Biome's `useSemanticElements` prefers over a bare `<div role="status">`). It
 * announces the auto-greet on mount and each re-spoken click line.
 *
 * The live region wraps ONLY the text. Any interactive control the bubble hosts
 * (the composer form) is a *sibling* of the `<output>`, deliberately OUTSIDE the
 * live region, so assistive tech never announces it as part of the spoken line
 * (ARIA APG: keep interactive controls out of live regions).
 *
 * Wide-panel redesign (2026-06-25): the bubble is a BORDERLESS text section INSIDE
 * the wide `.galaxy-astro__panel` glass surface — the panel owns the soft-glow
 * chrome (bg/blur/border/glow). The bubble renders the left-aligned spoken line; the
 * ASTRO speaker nameplate (● + ▽ notch) lives on the panel top-right. There is NO
 * manual dismiss control (owner 2026-06-25): ASTRO's line is ambient — a new line
 * replaces it, a tier-narration auto-clears (timed) or clears on a sprite click, and
 * the composer carries its own Cancel — so a collapse ▾ read as non-functional.
 *
 * Draw-only: the copy + the line-rotation rule live in the pure, unit-tested
 * `#/lib/galaxy/astro-voice` (the lib-pure rule). Entrance animation + the tail +
 * reduced-motion gate live in `.galaxy-astro*` CSS (src/styles.css).
 */

type Props = {
  /** The line ASTRO is currently speaking. `null` while the bubble hosts only the form. */
  message?: string | null;
  /**
   * Extra surface below the spoken line — the `AstroComposer` form (#183 dir. A).
   * Lives OUTSIDE the `<output>` live region so assistive tech never announces the
   * controls as part of the spoken line.
   */
  children?: ReactNode;
};

export const AstroBubble = ({ message = null, children }: Props) => (
  <div className="galaxy-astro__bubble pointer-events-auto">
    {message != null && (
      <output className="galaxy-astro__bubble-text" aria-live="polite">
        {message}
      </output>
    )}
    {children}
  </div>
);
