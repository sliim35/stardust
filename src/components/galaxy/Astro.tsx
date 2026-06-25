import { useState } from "react";
import { GALAXY_ASTRO_SCALE } from "#/lib/galaxy/astro";
import { nextClickIndex } from "#/lib/galaxy/astro-voice";
import type { MemoryStar } from "#/lib/galaxy/types";
import { getMessages, useLocale } from "#/lib/i18n";
import { AstroBubble } from "./AstroBubble";
import { AstroComposer } from "./AstroComposer";
import { AstroHub, type AstroHubProps } from "./AstroHub";
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
  /**
   * #125 — the active tier-transition narration line (already localized by the
   * owner of the transition state). While set it takes the bubble over — even a
   * dismissed bubble reopens for it; `null`/absent restores the spoken flow.
   */
  narration?: string | null;
  /** Clears the narration upstream (dismiss ×, or a click advancing the line). */
  onNarrationDismiss?: () => void;
  /**
   * #183 (dir. A) — ignite a saved star in the live sky (the store's `addStar`).
   * Its presence together with `canAddStar` enables the "Add your star" CTA that
   * opens the composer inside this bubble.
   */
  onStarAdded?: (star: MemoryStar) => void;
  /** Show the add-star CTA — true at the Milky-Way tier, where memory stars live (#183). */
  canAddStar?: boolean;
  /**
   * #250 (ADR-0017) — the ASTRO interaction hub (always-visible compact search +
   * fast-action pill row) hosted inside this frame. Absent (tests of the bare
   * mascot) → no hub renders. The hub's spoken responses route through this same
   * frame's `narration` bubble via its `onSpeak` sink (wired to `showNarration`).
   */
  hub?: AstroHubProps;
};

/**
 * What ASTRO is currently saying: the greeting (mount/auto-greet) or a click line
 * at `index` in the active locale's rotation. `null` once dismissed. Tracked as an
 * index, not the rendered string, so the bubble re-speaks in the active locale and
 * the click rotation stays locale-agnostic (#103).
 */
type Spoken =
  | { kind: "greeting" }
  | { kind: "line"; index: number }
  | { kind: "said"; text: string };

export const Astro = ({
  message,
  narration,
  onNarrationDismiss,
  onStarAdded,
  canAddStar = false,
  hub,
}: Props) => {
  const m = getMessages(useLocale());
  // Seed deterministically so SSR + the client agree on first paint (auto-greet
  // on mount, no hydration flip). `null` once dismissed.
  const [spoken, setSpoken] = useState<Spoken | null>({ kind: "greeting" });
  // #183 (dir. A) — when true the bubble hosts the add-star form instead of a line.
  // Client-only interaction state, false on first paint → SSR-stable.
  const [composing, setComposing] = useState(false);
  const { mood, emote } = useAstroFace();

  // The shared click trigger: speak the next line (#72) AND emote (#71) together.
  // A click during a tier narration (#125) also clears it, so the fresh click
  // line is what actually shows — the trigger never appears dead.
  const onClick = () => {
    if (narration != null) onNarrationDismiss?.();
    setSpoken((prev) => ({
      kind: "line",
      index: nextClickIndex(
        prev?.kind === "line" ? prev.index : null,
        m.astro.clickLines.length,
      ),
    }));
    emote();
  };

  // Resolve the displayed text: an active tier-transition narration (#125) takes
  // the bubble over; otherwise the active locale's catalog line (greeting unless
  // an explicit `message` override is set; otherwise the rotated click line).
  const spokenText =
    spoken == null
      ? null
      : spoken.kind === "greeting"
        ? (message ?? m.astro.greeting)
        : spoken.kind === "said"
          ? spoken.text
          : m.astro.clickLines[spoken.index];
  const text = narration ?? spokenText;

  // Dismissing a narration clears it upstream AND quiets the spoken line under
  // it, so the × closes the bubble instead of "revealing" a stale greeting.
  const onDismiss = () => {
    // While composing, × cancels the form back to ASTRO's line (it doesn't close ASTRO).
    if (composing) {
      setComposing(false);
      return;
    }
    if (narration != null) onNarrationDismiss?.();
    setSpoken(null);
  };

  // Open the composer IN the bubble; let it take over any active tier narration.
  const onAdd = () => {
    if (narration != null) onNarrationDismiss?.();
    setComposing(true);
  };

  // A saved star: ignite it in the live sky and let ASTRO speak the confirmation
  // through this same bubble — no separate narration round-trip.
  const onComposed = (star: MemoryStar, confirmation: string) => {
    onStarAdded?.(star);
    setComposing(false);
    if (narration != null) onNarrationDismiss?.();
    setSpoken({ kind: "said", text: confirmation });
  };

  // The add-star CTA shows only at a tier with memory stars, when wired, and when
  // not already composing.
  const showAdd = canAddStar && onStarAdded != null && !composing;

  return (
    <div className="galaxy-astro">
      {(text != null || composing) && (
        <AstroBubble message={composing ? null : text} onDismiss={onDismiss}>
          {composing ? (
            <AstroComposer onSuccess={onComposed} />
          ) : showAdd ? (
            <button
              type="button"
              className="galaxy-astro__add pointer-events-auto mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-snug border border-accent-soft bg-transparent px-3 py-1.5 font-sans text-sm font-semibold text-accent transition-colors duration-200 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
              onClick={onAdd}
            >
              <span aria-hidden="true">✦</span>
              {m.chat.open}
            </button>
          ) : null}
        </AstroBubble>
      )}
      {/* #250 (ADR-0017) — the always-visible interaction hub (search + pills),
          hosted in this frame above the sprite. Its spoken responses route through
          the same `narration` bubble via `onSpeak` (wired to `showNarration`), so
          there is no second a11y speech surface (the #72 invariant). */}
      {hub && <AstroHub {...hub} />}
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
