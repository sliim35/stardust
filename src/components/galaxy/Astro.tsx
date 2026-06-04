import { useState } from "react";
import { ASTRO_GREETING, nextClickLine } from "#/lib/galaxy/astro-voice";
import { AstroBubble } from "./AstroBubble";
import { PixelAstronaut } from "./PixelAstronaut";
import { useAstroFace } from "./useAstroFace";

/**
 * ASTRO (#70 + #72) — the galaxy's quiet host, pinned in the reserved bottom-right
 * slot. A sibling of `<GalaxyChrome />` in the viewport-fixed `.galaxy-chrome-overlay`
 * (#76 lifted it out of `.galaxy-stage__fit` so it holds a fixed readable size in the
 * corner like the title, rather than shrinking with the stage; it never took the
 * camera/parallax).
 *
 * The sprite is decorative pixel-art chrome: `aria-hidden`, gently bobbing — never a
 * tab stop. The *words* carry meaning (#72), so the speech bubble — not the figure —
 * is the a11y surface (`AstroBubble`'s `aria-live` region). ASTRO speaks by:
 *   - **auto-greeting on mount** with the confirmed opening line, and
 *   - **re-speaking** a fresh line each time the sprite is clicked.
 *
 * SSR/Workers-safe: the spoken message is seeded in the initial `useState` (the
 * `message` prop, else the greeting), so the bubble renders identically server- and
 * client-side on first paint — no `useEffect` visibility flip, no hydration mismatch.
 *
 * The sprite wrapper stays `pointer-events: none` (clicks pass through to the stars);
 * only the click hit-area opts back in (`pointer-events: auto`) as a focusable,
 * keyboard-activatable `<button aria-label>` — the unified click trigger. Placement,
 * the bob/drift, the small-screen hide, and the reduced-motion gate all live in
 * `.galaxy-astro*` CSS (src/styles.css).
 *
 * #71 — expressions: `useAstroFace` drives the ambient idle-blink + the
 * click → emotion change. The single `onClick` is the shared trigger seam: it
 * speaks the next line (#72) AND advances the mood (#71) on the same click, so the
 * two layers stay one interaction. The face mood feeds `PixelAstronaut`'s `mood`
 * prop; the figure never shifts — only the glowing pixel-eyes change.
 */

type Props = {
  /**
   * #72 seam (from #70) — the line ASTRO opens with. `undefined` (default) →
   * the confirmed memorial greeting. Set it to override the auto-greet copy.
   */
  message?: string;
};

export const Astro = ({ message }: Props) => {
  // Seed the spoken line deterministically so SSR + the client agree on first
  // paint (auto-greet on mount, no hydration flip). `null` once dismissed.
  const [spoken, setSpoken] = useState<string | null>(
    message ?? ASTRO_GREETING,
  );
  const { mood, emote } = useAstroFace();

  // The shared click trigger: speak the next line (#72) AND emote (#71) together.
  const onClick = () => {
    setSpoken((prev) => nextClickLine(prev));
    emote();
  };

  return (
    <div className="galaxy-astro">
      {spoken != null && (
        <AstroBubble message={spoken} onDismiss={() => setSpoken(null)} />
      )}
      <button
        type="button"
        className="galaxy-astro__hit"
        aria-label="hear from ASTRO"
        onClick={onClick}
      >
        <span className="galaxy-astro__drift" aria-hidden="true">
          <PixelAstronaut mood={mood} />
        </span>
      </button>
    </div>
  );
};
