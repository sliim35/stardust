import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AstroMood,
  DEFAULT_MOOD,
  EMOTE_SETTLE_MS,
  nextClickMood,
  startBlinkLoop,
} from "#/lib/galaxy/astro";

/**
 * Drives ASTRO's facial expression (#71) — the ambient idle-blink and the
 * click → emotion change — over the pure, unit-tested model in `#/lib/galaxy/astro`
 * (`nextClickMood`, `startBlinkLoop`, the timing constants). This hook is the thin
 * React shell around that model: it holds the `mood` state, supplies the blink
 * callbacks, and owns the `prefers-reduced-motion` gate + the settle timer.
 *
 * Behaviour:
 *  - **Idle blink (AC1):** while resting on `calm`, a ~120 ms dip to `blink` every
 *    4–8 s (jittered via `startBlinkLoop`, never a metronome). Disabled entirely
 *    under `prefers-reduced-motion: reduce` — ASTRO holds the static `calm` frame.
 *  - **Click → emote (AC2):** `emote()` advances the situational mood cycle
 *    (`nextClickMood`) and arms a settle-back-to-`calm` timer (`EMOTE_SETTLE_MS`).
 *    A repeat click before settle re-arms the timer and advances the cycle. The
 *    emote is a discrete state swap (not a continuous animation), so it stays live
 *    under reduced-motion — only the ambient blink micro-animation is gated.
 *
 * SSR/Workers-safe: the initial render is the deterministic `DEFAULT_MOOD` (`calm`)
 * on both server and client — all timer/`matchMedia` work is deferred to effects,
 * so there is no hydration mismatch.
 */

type AstroFace = {
  /** The mood to render right now. */
  mood: AstroMood;
  /** Trigger a click-emote: advance the situational cycle, then settle to calm. */
  emote: () => void;
};

export const useAstroFace = (): AstroFace => {
  const [mood, setMood] = useState<AstroMood>(DEFAULT_MOOD);

  // The live mood, mirrored in a ref so the blink loop can read it without
  // re-subscribing (it only blinks while resting on `calm`).
  const moodRef = useRef<AstroMood>(DEFAULT_MOOD);
  moodRef.current = mood;

  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emote = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setMood((prev) => nextClickMood(prev));
    settleTimer.current = setTimeout(() => {
      setMood(DEFAULT_MOOD);
      settleTimer.current = null;
    }, EMOTE_SETTLE_MS);
  }, []);

  // Idle blink — the jittered 4–8 s, ~120 ms dip loop lives in the unit-tested
  // `startBlinkLoop`; this effect just supplies the callbacks + the reduced-motion
  // gate. Read reduced-motion once at mount (matches the camera/backdrop convention).
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return; // AC1: hold the static calm frame, no ambient blink

    return startBlinkLoop({
      // Only blink at true rest — never interrupt a click-emote.
      isResting: () => moodRef.current === DEFAULT_MOOD,
      onBlink: () => setMood("blink"),
      // Reopen only if still mid-blink (a click during the dip wins).
      onReopen: () => setMood((cur) => (cur === "blink" ? DEFAULT_MOOD : cur)),
    });
  }, []);

  // Clear any pending settle on unmount.
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  return { mood, emote };
};
