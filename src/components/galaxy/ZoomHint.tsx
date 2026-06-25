import { useEffect, useState } from "react";

/**
 * The scroll/zoom discoverability hint (#251, BR38) — an ambient signifier that
 * tells a first-time visitor the galaxy is explorable by *scrolling* (the
 * tier-zoom gesture is otherwise invisible). It addresses a hidden gesture with a
 * visible cue: Norman's recognition-over-recall + signifiers (BRD `ux_laws`).
 *
 * It is **ambient, not interruptive**: a dim, bottom-centre wheel glyph + one
 * short line, `pointer-events:none` so it never blocks a click/scroll meant for
 * the canvas, ASTRO, the breadcrumb, or any other chrome (AC5). It **persists
 * until the visitor's first scroll/wheel/pinch gesture** (AC2/AC3) — there is no
 * dwell timer (the owner reworked AC3: a short dwell hid it before it could even
 * be noticed). Once dismissed it is marked *seen* in `sessionStorage`, so it
 * shows once and does not reappear next session (AC3). It is subtle + non-blocking,
 * so persisting until the gesture is fine.
 *
 * **The dismiss seam is a window-level listener, by design.** The hint listens to
 * `wheel` (+ `touchmove` for pinch) on `window` in the capture phase rather than
 * to the stage's own `onWheel` — the astro-loader can swallow an early wheel event
 * before it reaches the stage, and a window-capture listener catches the gesture
 * wherever it lands (the #109/loader gotcha). It is passive (never `preventDefault`)
 * so it does not interfere with the real zoom; it only *observes* the first gesture.
 *
 * **SSR-safe (ADR-0003, the usePalette pattern):** it starts hidden so the server
 * markup and the first client render agree (no `sessionStorage`/`window` at render
 * scope, no hydration mismatch); an effect reads `sessionStorage` after mount and
 * reveals it only if unseen. From the visitor's view that is still "on first load".
 *
 * **`prefers-reduced-motion` (AC4):** the only motion is gated behind Tailwind's
 * `motion-safe:` — under reduced-motion the glyph renders static and the hint still
 * auto-dismisses on the same triggers. No motion-based animation ever fires.
 *
 * **Styling boundary (#75 / code-style.md):** Tailwind utilities only — no
 * `styles.css`. Pinned bottom-centre at fixed px + safe-area like the other chrome.
 */

/** The `sessionStorage` flag marking the hint seen (one source of truth). */
export const ZOOM_HINT_SEEN_KEY = "stardust:zoom-hint-seen";

type Props = {
  /** The hint copy + accessible name (i18n `zoomHint.label`), resolved by the caller. */
  label: string;
};

/** Has the visitor already seen the hint this session? (SSR-safe — guards `window`.) */
const alreadySeen = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(ZOOM_HINT_SEEN_KEY) === "1";
  } catch {
    // Private-mode / disabled storage → treat as unseen (it shows until a scroll).
    return false;
  }
};

/** Persist the seen flag (best-effort — a storage failure must never crash the UI). */
const markSeen = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ZOOM_HINT_SEEN_KEY, "1");
  } catch {
    /* ignore — storage unavailable */
  }
};

export const ZoomHint = ({ label }: Props) => {
  // Start hidden so SSR and the first client render agree (no storage read at
  // render scope). The effect reveals it after mount when unseen this session.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alreadySeen()) return;
    setVisible(true);

    // Observe the SAME gesture that drives the zoom — on window, capture phase,
    // passive (observe-only) so it catches the first wheel/pinch even if the
    // loader/stage would otherwise swallow it. There is NO dwell timer: the hint
    // persists until the visitor's first scroll (the owner reworked AC3).
    const opts: AddEventListenerOptions = { capture: true, passive: true };

    // `dismiss` tears down BOTH listeners itself, so the first of {wheel,
    // touchmove} wins and a later scroll can't re-run it. Can't lean on
    // `{once:true}` — it only auto-detaches the ONE listener that fired, leaving
    // the other live for the whole session (the component never unmounts after
    // hiding). Idempotent: removeEventListener on an already-gone target no-ops.
    const dismiss = () => {
      window.removeEventListener("wheel", dismiss, opts);
      window.removeEventListener("touchmove", dismiss, opts);
      markSeen();
      setVisible(false);
    };

    window.addEventListener("wheel", dismiss, opts);
    window.addEventListener("touchmove", dismiss, opts);

    // The unmount path tears down too (e.g. a locale/key change re-runs the
    // effect before a gesture fired).
    return () => {
      window.removeEventListener("wheel", dismiss, opts);
      window.removeEventListener("touchmove", dismiss, opts);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      data-testid="zoom-hint"
      // Pinned bottom-centre at fixed px + safe-area, below the interactive chrome
      // (no z above the palette's z-[6] — it never needs to sit over chrome). It is
      // a passive signifier: `pointer-events-none` so every click/scroll passes
      // through to the canvas + chrome (AC5). It carries no entrance animation —
      // the only motion is the glyph's motion-safe: tilt/bob, off under
      // reduced-motion (AC4).
      className="pointer-events-none absolute bottom-[max(22px,env(safe-area-inset-bottom))] left-1/2 z-0 flex -translate-x-1/2 select-none items-center gap-2"
      role="note"
      aria-label={label}
    >
      {/* The wheel glyph — a quiet mouse outline with a scroll wheel. Its gentle
          up→down tilt/bob (the `zoom-hint-tilt` @theme animation) suggests the
          scroll gesture; gated behind motion-safe: so reduced-motion gets a static
          glyph (AC4). Decorative (the copy carries the meaning). */}
      <svg
        width={16}
        height={22}
        viewBox="0 0 16 22"
        fill="none"
        aria-hidden="true"
        className="text-dim-2 motion-safe:animate-zoom-hint-tilt"
      >
        <rect
          x={1}
          y={1}
          width={14}
          height={20}
          rx={7}
          stroke="currentColor"
          strokeWidth={1.4}
        />
        <line
          x1={8}
          y1={5}
          x2={8}
          y2={9}
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
      <span className="rounded-snug bg-space-deep/60 px-2 py-px font-mono text-[11px] tracking-[0.14em] text-dim-2 uppercase">
        {label}
      </span>
    </div>
  );
};
