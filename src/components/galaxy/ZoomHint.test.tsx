// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZOOM_HINT_SEEN_KEY, ZoomHint } from "#/components/galaxy/ZoomHint";
import { en } from "#/lib/i18n/messages/en";

const LABEL = en.zoomHint.label;

// AC4 (reduced-motion) is enforced statically: the component reads no
// `matchMedia` — it gates its only motion behind Tailwind `motion-safe:`, which
// the browser disables under `prefers-reduced-motion: reduce`. So the real gate
// is the class scan below (no raw `animate-*`), not a `matchMedia` stub.
describe("ZoomHint — the scroll-to-zoom discoverability signifier (#251)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  // AC1 — first load: the hint renders in the bottom area.
  it("AC1 — renders on first load when sessionStorage is unset", () => {
    render(<ZoomHint label={LABEL} />);
    expect(screen.getByText(LABEL)).toBeTruthy();
  });

  // AC5 — non-blocking: the hint container never captures pointer events.
  it("AC1/AC5 — the container is pointer-events:none (clicks pass through)", () => {
    render(<ZoomHint label={LABEL} />);
    const hint = screen.getByTestId("zoom-hint");
    expect(hint.className).toContain("pointer-events-none");
  });

  // AC2 — auto-dismiss on the first wheel/zoom gesture.
  it("AC2 — dismisses on the first wheel event (the zoom gesture)", () => {
    render(<ZoomHint label={LABEL} />);
    expect(screen.queryByText(LABEL)).toBeTruthy();
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -120 }));
    });
    expect(screen.queryByText(LABEL)).toBeNull();
  });

  // AC2 — pinch (touchmove) also dismisses it.
  it("AC2 — dismisses on a touchmove (pinch) gesture", () => {
    render(<ZoomHint label={LABEL} />);
    act(() => {
      window.dispatchEvent(new Event("touchmove"));
    });
    expect(screen.queryByText(LABEL)).toBeNull();
  });

  // AC3 (reworked by the owner) — the hint PERSISTS until the first scroll: there
  // is NO dwell timer. Advancing time alone must NOT hide it.
  it("AC3 — does NOT auto-hide on a timer (persists until a scroll)", () => {
    vi.useFakeTimers();
    render(<ZoomHint label={LABEL} />);
    expect(screen.queryByText(LABEL)).toBeTruthy();
    act(() => {
      // Far longer than any plausible dwell — it must still be visible.
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.queryByText(LABEL)).toBeTruthy();
  });

  // Regression (review SHOULD #255) — the scroll-dismiss tears down BOTH gesture
  // listeners, so the second one doesn't linger for the whole session (the
  // component never unmounts after hiding) and a later scroll stays inert.
  it("removes BOTH the wheel + touchmove listeners on the first dismiss", () => {
    const removed: string[] = [];
    const spy = vi
      .spyOn(window, "removeEventListener")
      .mockImplementation((type) => {
        removed.push(String(type));
      });
    render(<ZoomHint label={LABEL} />);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    });
    expect(removed).toContain("wheel");
    expect(removed).toContain("touchmove");
    spy.mockRestore();
  });

  // AC3 — once dismissed, the "seen" flag is persisted to sessionStorage.
  it("AC3 — persists the seen flag to sessionStorage on dismiss", () => {
    render(<ZoomHint label={LABEL} />);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 1 }));
    });
    expect(window.sessionStorage.getItem(ZOOM_HINT_SEEN_KEY)).toBe("1");
  });

  // AC3 — does NOT reappear in the same session (sessionStorage already set).
  it("AC3 — does not render when the seen flag is already set", () => {
    window.sessionStorage.setItem(ZOOM_HINT_SEEN_KEY, "1");
    render(<ZoomHint label={LABEL} />);
    expect(screen.queryByText(LABEL)).toBeNull();
  });

  // AC4 — no element carries a raw (always-on) `animate-*` class, so under
  // `prefers-reduced-motion: reduce` the hint renders static (any motion is
  // `motion-safe:`-gated, which the browser disables).
  it("AC4 — renders without any always-on animation (static under reduced-motion)", () => {
    render(<ZoomHint label={LABEL} />);
    const hint = screen.getByTestId("zoom-hint");
    for (const el of hint.querySelectorAll("*")) {
      for (const cls of el.classList) {
        if (cls.startsWith("animate-")) {
          throw new Error(`unexpected always-on animation class: ${cls}`);
        }
      }
    }
    // It still renders (static), satisfying "renders statically and dismisses".
    expect(screen.getByText(LABEL)).toBeTruthy();
  });

  // AC4 — the auto-dismiss is motion-independent (a window listener, not an
  // animation), so it fires identically whether or not motion is reduced.
  it("AC4 — still dismisses on a wheel gesture (dismiss is not motion-gated)", () => {
    render(<ZoomHint label={LABEL} />);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    });
    expect(screen.queryByText(LABEL)).toBeNull();
  });

  // Any motion the hint shows is opt-in: every `animate-*` token must be
  // `motion-safe:`-prefixed (so reduced-motion disables it), never raw. The glyph
  // carries the scroll-suggesting tilt/bob token specifically (owner #255 feedback).
  it("AC4 — the tilt token is present and motion-safe:-gated (no raw animation)", () => {
    render(<ZoomHint label={LABEL} />);
    const hint = screen.getByTestId("zoom-hint");
    const tokens = [hint, ...hint.querySelectorAll("*")].flatMap((el) => [
      ...el.classList,
    ]);
    const animTokens = tokens.filter((t) => t.includes("animate-"));
    // The scroll-suggesting tilt/bob is applied, motion-safe:-gated.
    expect(animTokens).toContain("motion-safe:animate-zoom-hint-tilt");
    // And EVERY animate-* token is gated behind motion-safe: (none ever raw).
    for (const t of animTokens) {
      expect(t.startsWith("motion-safe:")).toBe(true);
    }
  });
});
