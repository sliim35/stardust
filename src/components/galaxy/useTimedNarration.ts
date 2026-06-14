import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ASTRO narration with a MINIMUM on-screen dwell (#183 polish — owner, 2026-06-14:
 * "add a delay of at least 3s between narration phrases, it's not readable now").
 *
 * The tier-transition lines (#125) fire at the camera-animation cadence — a depart
 * line can be replaced by the arrival line in ~1s, too fast to read. This gates the
 * *text*, not the camera: a new phrase that would replace one shown less than `minMs`
 * ago is deferred until the dwell elapses, so every line stays up long enough to
 * read. The deferred phrase's own dwell starts when it actually appears. `clear`
 * (bubble dismiss / ASTRO click) is always immediate.
 *
 * SSR-safe (ADR-0003): `Date.now()` and timers run only inside the client,
 * event-driven `show`/`clear` callbacks — never at module scope or in the render
 * path. Initial state is `null`, so SSR and the first client paint agree.
 */
export const useTimedNarration = (minMs: number) => {
  const [narration, setNarration] = useState<string | null>(null);
  // When the last phrase ACTUALLY became visible, in epoch ms — the dwell clock the
  // next phrase waits behind. Updated only when a phrase shows (never on defer), so a
  // phrase superseded while still pending doesn't push the deadline further out.
  const lastShownAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear a pending phrase on unmount so it never fires on a gone component.
  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback(
    (text: string | null) => {
      if (timer.current != null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      // A null phrase (a tier with no line) clears immediately — no dwell to honor.
      if (text == null) {
        setNarration(null);
        return;
      }
      const now = Date.now();
      const wait = Math.max(0, minMs - (now - lastShownAt.current));
      if (wait === 0) {
        lastShownAt.current = now;
        setNarration(text);
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        lastShownAt.current = Date.now();
        setNarration(text);
      }, wait);
    },
    [minMs],
  );

  const clear = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setNarration(null);
  }, []);

  return { narration, show, clear } as const;
};
