/**
 * Tests for §3 — DEEPLINK_FRAMING_ZOOM + HighlightController (AC3.1, ADR-0018 §3).
 *
 * DEEPLINK_FRAMING_ZOOM: a named constant for the in-context deep-link zoom.
 * Must be < 1.8 (the focusOn default) and >= 1 (sane in-context band).
 *
 * HighlightController: a pure request channel (mirrors FocusController) for
 * setting and clearing a highlighted star id — the seam from GalaxyStage into
 * the star layers. Clear is component-side (timer-driven in GalaxyStage).
 */

import { describe, expect, it } from "vitest";
import { DEEPLINK_FRAMING_ZOOM } from "#/lib/galaxy/focus";
import {
  createHighlightController,
  type HighlightRequest,
} from "#/lib/galaxy/highlight";

// ─── DEEPLINK_FRAMING_ZOOM ────────────────────────────────────────────────────

describe("DEEPLINK_FRAMING_ZOOM — the in-context deep-link zoom constant (AC3.1)", () => {
  it("is in the sane in-context band: >= 1 (whole disk) and < 1.8 (close-up inspect)", () => {
    expect(DEEPLINK_FRAMING_ZOOM).toBeGreaterThanOrEqual(1);
    expect(DEEPLINK_FRAMING_ZOOM).toBeLessThan(1.8);
  });

  it("is strictly less than the focusOn default zoom of 1.8 (no extreme close-up)", () => {
    expect(DEEPLINK_FRAMING_ZOOM).toBeLessThan(1.8);
  });

  it("equals 1.15 (the ADR-0018 default — owner-tunable knob)", () => {
    // Owner-tunable: 1.0 / 1.15 / 1.3; 1.15 is the default.
    expect(DEEPLINK_FRAMING_ZOOM).toBe(1.15);
  });
});

// ─── HighlightController ──────────────────────────────────────────────────────

describe("createHighlightController — the highlight request channel (AC3.1)", () => {
  it("emits a highlight request with the star id when highlight() is called", () => {
    const ctl = createHighlightController();
    const seen: HighlightRequest[] = [];
    ctl.subscribe((r) => seen.push(r));
    ctl.highlight("star-42");
    expect(seen).toEqual([{ kind: "highlight", id: "star-42" }]);
  });

  it("emits a clear request when clear() is called", () => {
    const ctl = createHighlightController();
    const seen: HighlightRequest[] = [];
    ctl.subscribe((r) => seen.push(r));
    ctl.clear();
    expect(seen).toEqual([{ kind: "clear" }]);
  });

  it("fans requests out to every subscriber", () => {
    const ctl = createHighlightController();
    const a: HighlightRequest[] = [];
    const b: HighlightRequest[] = [];
    ctl.subscribe((r) => a.push(r));
    ctl.subscribe((r) => b.push(r));
    ctl.highlight("star-1");
    expect(a).toEqual([{ kind: "highlight", id: "star-1" }]);
    expect(b).toEqual(a);
  });

  it("stops delivering after unsubscribe", () => {
    const ctl = createHighlightController();
    const seen: HighlightRequest[] = [];
    const off = ctl.subscribe((r) => seen.push(r));
    ctl.highlight("star-1");
    off();
    ctl.highlight("star-2");
    ctl.clear();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ kind: "highlight", id: "star-1" });
  });

  it("a highlight followed by a clear removes the highlight", () => {
    const ctl = createHighlightController();
    const seen: HighlightRequest[] = [];
    ctl.subscribe((r) => seen.push(r));
    ctl.highlight("star-7");
    ctl.clear();
    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual({ kind: "highlight", id: "star-7" });
    expect(seen[1]).toEqual({ kind: "clear" });
  });

  it("is SSR-safe: no module-scope state; fresh controller per call", () => {
    const a = createHighlightController();
    const b = createHighlightController();
    const seenA: HighlightRequest[] = [];
    const seenB: HighlightRequest[] = [];
    a.subscribe((r) => seenA.push(r));
    b.subscribe((r) => seenB.push(r));
    a.highlight("star-1");
    b.highlight("star-2");
    expect(seenA).toEqual([{ kind: "highlight", id: "star-1" }]);
    expect(seenB).toEqual([{ kind: "highlight", id: "star-2" }]);
  });
});
