// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZOOM_HINT_SEEN_KEY, ZoomHint } from "#/components/galaxy/ZoomHint";
import { en } from "#/lib/i18n/messages/en";

const LABEL = en.zoomHint.label;

/** Stub `prefers-reduced-motion: reduce` → true for one test, restore after. */
const stubReducedMotion = (reduce: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reduce,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
};

describe("ZoomHint — the scroll-to-zoom discoverability signifier (#251)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  // AC3 — dwell auto-hide after the configured timeout (no zoom).
  it("AC3 — auto-hides after the dwell timeout with no interaction", () => {
    vi.useFakeTimers();
    render(<ZoomHint label={LABEL} dwellMs={6000} />);
    expect(screen.queryByText(LABEL)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText(LABEL)).toBeNull();
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

  // AC4 — prefers-reduced-motion: renders statically (no motion animation class).
  it("AC4 — under prefers-reduced-motion it renders without a motion animation", () => {
    stubReducedMotion(true);
    render(<ZoomHint label={LABEL} />);
    const hint = screen.getByTestId("zoom-hint");
    // No element inside the hint carries a raw (always-on) `animate-*` class —
    // any motion is gated behind `motion-safe:` so reduced-motion shows static.
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

  // AC4 — reduced-motion still auto-dismisses on a zoom gesture.
  it("AC4 — under prefers-reduced-motion it still dismisses on a wheel gesture", () => {
    stubReducedMotion(true);
    render(<ZoomHint label={LABEL} />);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    });
    expect(screen.queryByText(LABEL)).toBeNull();
  });

  // Any motion the hint shows is opt-in: every `animate-*` token must be
  // `motion-safe:`-prefixed (so reduced-motion disables it), never raw.
  it("AC4 — every animate-* token is motion-safe:-prefixed (no raw animation)", () => {
    render(<ZoomHint label={LABEL} />);
    const hint = screen.getByTestId("zoom-hint");
    const tokens = [hint, ...hint.querySelectorAll("*")].flatMap((el) => [
      ...el.classList,
    ]);
    const animTokens = tokens.filter((t) => t.includes("animate-"));
    // There IS at least one ambient animation token (the glyph breathes)…
    expect(animTokens.length).toBeGreaterThan(0);
    // …and every one of them is gated behind motion-safe:.
    for (const t of animTokens) {
      expect(t.startsWith("motion-safe:")).toBe(true);
    }
  });
});
