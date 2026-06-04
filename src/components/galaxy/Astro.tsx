import { useState } from "react";
import { GALAXY_ASTRO_SCALE } from "#/lib/galaxy/astro";
import { nextClickIndex } from "#/lib/galaxy/astro-voice";
import { getMessages, useLocale } from "#/lib/i18n";
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
 *
 * Layout: `.galaxy-astro` is the **stable, un-animated corner frame** — the bubble
 * is a direct child anchored to that frame, so the reading position stays steady
 * while only the sprite bobs/drifts beneath it (`__bob` carries `astro-bob`, `__drift`
 * the secondary wander). The sprite is rendered at `GALAXY_ASTRO_SCALE` (the single
 * size knob), bigger than the prototype default so it sits with the bubble.
 */

type Props = {
  /**
   * #72 seam (from #70) — override the line ASTRO opens with. `undefined`
   * (default) → the localized memorial greeting from the catalog. An explicit
   * string overrides the auto-greet copy verbatim (not localized).
   */
  message?: string;
};

/**
 * What ASTRO is currently saying: the greeting (mount/auto-greet) or a click line
 * at `index` in the active locale's rotation. `null` once dismissed. Tracked as an
 * index, not the rendered string, so the bubble re-speaks in the active locale and
 * the click rotation stays locale-agnostic (#103).
 */
type Spoken = { kind: "greeting" } | { kind: "line"; index: number };

export const Astro = ({ message }: Props) => {
  const m = getMessages(useLocale());
  // Seed deterministically so SSR + the client agree on first paint (auto-greet
  // on mount, no hydration flip). `null` once dismissed.
  const [spoken, setSpoken] = useState<Spoken | null>({ kind: "greeting" });
  const { mood, emote } = useAstroFace();

  // The shared click trigger: speak the next line (#72) AND emote (#71) together.
  const onClick = () => {
    setSpoken((prev) => ({
      kind: "line",
      index: nextClickIndex(
        prev?.kind === "line" ? prev.index : null,
        m.astro.clickLines.length,
      ),
    }));
    emote();
  };

  // Resolve the displayed text from the active locale's catalog (greeting unless
  // an explicit `message` override is set; otherwise the rotated click line).
  const text =
    spoken == null
      ? null
      : spoken.kind === "greeting"
        ? (message ?? m.astro.greeting)
        : m.astro.clickLines[spoken.index];

  return (
    <div className="galaxy-astro">
      {text != null && (
        <AstroBubble message={text} onDismiss={() => setSpoken(null)} />
      )}
      <button
        type="button"
        className="galaxy-astro__hit"
        aria-label="hear from ASTRO"
        onClick={onClick}
      >
        <span className="galaxy-astro__bob" aria-hidden="true">
          <span className="galaxy-astro__drift">
            <PixelAstronaut mood={mood} scale={GALAXY_ASTRO_SCALE} />
          </span>
        </span>
      </button>
    </div>
  );
};
