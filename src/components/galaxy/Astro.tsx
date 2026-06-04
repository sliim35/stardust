import { useState } from "react";
import { ASTRO_GREETING, nextClickLine } from "#/lib/galaxy/astro-voice";
import { AstroBubble } from "./AstroBubble";
import { PixelAstronaut } from "./PixelAstronaut";

/**
 * ASTRO (#70 + #72) — the galaxy's quiet host, pinned in the reserved bottom-right
 * slot of the stage. A sibling of `<GalaxyChrome />` inside `.galaxy-stage__fit`, so
 * it scales with `--stage-scale` but ignores the camera/parallax (it stays in the
 * corner like the title).
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
 * keyboard-activatable `<button aria-label>` — the unified click trigger #71 also
 * hooks into when it ships. Placement, the bob/drift, the small-screen hide, and the
 * reduced-motion gate all live in `.galaxy-astro*` CSS (src/styles.css).
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

  const speakNext = () => setSpoken((prev) => nextClickLine(prev ?? undefined));

  return (
    <div className="galaxy-astro">
      {spoken != null && (
        <AstroBubble message={spoken} onDismiss={() => setSpoken(null)} />
      )}
      <button
        type="button"
        className="galaxy-astro__hit"
        aria-label="hear from ASTRO"
        onClick={speakNext}
      >
        <span className="galaxy-astro__drift" aria-hidden="true">
          <PixelAstronaut />
        </span>
      </button>
    </div>
  );
};
