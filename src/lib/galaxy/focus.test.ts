import { describe, expect, it } from "vitest";
import type { Camera } from "#/lib/galaxy/camera";
import { ZOOM_MIN } from "#/lib/galaxy/camera";
import {
  back,
  createFocus,
  createFocusController,
  DEFAULT_FRAMING,
  type FocusRequest,
  focusCamera,
  isArrived,
  resolveFocusTarget,
  stepFocus,
} from "#/lib/galaxy/focus";
import { polarToXY } from "#/lib/galaxy/place";
import type { GalaxySky, MemoryStar } from "#/lib/galaxy/types";

const cam = (cx: number, cy: number, zoom: number): Camera => ({
  cx,
  cy,
  zoom,
});

const star = (over: Partial<MemoryStar> = {}): MemoryStar => ({
  id: "s1",
  text: "a memory",
  mood: "wonder",
  color: "#abcdef",
  r: 0.5,
  angle: 1,
  brightness: 0.7,
  createdAt: 1,
  ...over,
});

const skyOf = (stars: MemoryStar[]): GalaxySky => ({
  backdrop: {
    seed: 1,
    branches: 4,
    spin: 0,
    randomnessPower: 2.2,
    palette: "auroral",
  },
  stars,
});

describe("createFocus", () => {
  it("starts at rest: current === target, not focusing, no prior framing", () => {
    const s = createFocus(DEFAULT_FRAMING);
    expect(s.current).toEqual(DEFAULT_FRAMING);
    expect(s.target).toEqual(DEFAULT_FRAMING);
    expect(s.focusing).toBe(false);
    expect(s.prior).toBeNull();
  });
});

describe("resolveFocusTarget (focus by star id → eased camera target)", () => {
  it("resolves a known star id to a camera centered on its stage position", () => {
    const sky = skyOf([star({ id: "s1", r: 0.5, angle: 1 })]);
    const pos = polarToXY(0.5, 1);
    const target = resolveFocusTarget(sky, "s1");
    expect(target).toEqual({ cx: pos.x, cy: pos.y, zoom: 1.8 });
  });

  it("honors an explicit zoom override", () => {
    const sky = skyOf([star({ id: "s1" })]);
    expect(resolveFocusTarget(sky, "s1", 2.5)?.zoom).toBe(2.5);
  });

  it("returns null for an unknown id (graceful — no throw)", () => {
    const sky = skyOf([star({ id: "s1" })]);
    expect(resolveFocusTarget(sky, "nope")).toBeNull();
  });
});

describe("focusCamera (start an interruptible ease)", () => {
  it("sets a new target and saves the current framing as prior", () => {
    const s0 = createFocus(DEFAULT_FRAMING);
    const t = cam(760, 440, 1.8);
    const s1 = focusCamera(s0, t);
    expect(s1.target).toEqual(t);
    expect(s1.focusing).toBe(true);
    expect(s1.prior).toEqual(DEFAULT_FRAMING);
  });

  it("does not jump: current is unchanged when a focus starts (the ease is stepped)", () => {
    const s0 = createFocus(DEFAULT_FRAMING);
    const s1 = focusCamera(s0, cam(760, 440, 1.8));
    expect(s1.current).toEqual(DEFAULT_FRAMING); // existing framing never snaps
  });

  it("is pure — does not mutate the prior state", () => {
    const s0 = createFocus(DEFAULT_FRAMING);
    focusCamera(s0, cam(1, 2, 3));
    expect(s0.target).toEqual(DEFAULT_FRAMING);
    expect(s0.focusing).toBe(false);
    expect(s0.prior).toBeNull();
  });
});

describe("focusCamera interrupt — a new focus cancels the in-flight move", () => {
  it("retargets mid-ease and keeps the ORIGINAL prior framing for back()", () => {
    const s0 = createFocus(DEFAULT_FRAMING);
    const s1 = focusCamera(s0, cam(760, 440, 1.8)); // focus A
    const mid = stepFocus(s1, 0.3); // partway to A — never reached A
    const s2 = focusCamera(mid, cam(200, 200, 2)); // focus B interrupts
    expect(s2.target).toEqual(cam(200, 200, 2));
    expect(s2.focusing).toBe(true);
    // back() should still return to where we started exploring, not to A
    expect(s2.prior).toEqual(DEFAULT_FRAMING);
    // and it eases from where the interrupted move actually was (no snap)
    expect(s2.current).toEqual(mid.current);
  });
});

describe("back (ESC) — return to the prior framing", () => {
  it("eases back toward the saved prior framing and clears it", () => {
    const s0 = createFocus(DEFAULT_FRAMING);
    const s1 = focusCamera(s0, cam(760, 440, 1.8));
    const arrived = stepFocus(s1, 1); // fully on the star
    const b = back(arrived);
    expect(b.target).toEqual(DEFAULT_FRAMING); // heading home
    expect(b.focusing).toBe(true);
    expect(b.prior).toBeNull(); // the prior was consumed
  });

  it("falls back to a zoomed-out default when there is no prior framing", () => {
    const s0 = createFocus(cam(760, 440, 1.8)); // deep-linked straight onto a star
    const b = back(s0);
    expect(b.target).toEqual(DEFAULT_FRAMING);
    expect(b.target.zoom).toBeLessThan(s0.current.zoom); // zoomed out
    expect(b.focusing).toBe(true);
  });
});

describe("stepFocus — eased frame stepping (composes lerpCamera)", () => {
  it("moves current strictly toward the target without overshooting", () => {
    const s0 = focusCamera(createFocus(cam(0, 0, 1)), cam(100, 200, 2));
    const s1 = stepFocus(s0, 0.5);
    expect(s1.current).toEqual({ cx: 50, cy: 100, zoom: 1.5 });
    expect(s1.focusing).toBe(true); // not arrived yet
  });

  it("settles focusing=false once the target is reached", () => {
    const s0 = focusCamera(createFocus(cam(0, 0, 1)), cam(100, 200, 2));
    const s1 = stepFocus(s0, 1); // t=1 lands exactly on target
    expect(s1.current).toEqual(cam(100, 200, 2));
    expect(s1.focusing).toBe(false);
  });
});

describe("reduced motion — snap instead of animate (drive t=1)", () => {
  it("snaps current straight to the target in one step", () => {
    const s0 = focusCamera(createFocus(cam(0, 0, 1)), cam(100, 200, 2));
    const snapped = stepFocus(s0, 0.05, true); // small t, but reduce=true → snaps
    expect(snapped.current).toEqual(cam(100, 200, 2));
    expect(snapped.focusing).toBe(false);
  });
});

describe("DEFAULT_FRAMING — the zoomed-out home view", () => {
  it("is a valid, zoomed-out camera within the clamp range", () => {
    expect(DEFAULT_FRAMING.zoom).toBeGreaterThanOrEqual(ZOOM_MIN);
    expect(DEFAULT_FRAMING.zoom).toBeLessThan(1.8); // more zoomed out than focus zoom
  });
});

describe("isArrived — frame-loop settle predicate", () => {
  it("is true within an epsilon of the target", () => {
    expect(isArrived(cam(100, 200, 2), cam(100, 200, 2))).toBe(true);
    expect(isArrived(cam(100.0001, 200, 2), cam(100, 200, 2))).toBe(true);
  });

  it("is false while still meaningfully far from the target", () => {
    expect(isArrived(cam(50, 100, 1.5), cam(100, 200, 2))).toBe(false);
  });
});

describe("createFocusController (the focus-by-id seam for #5 / #113)", () => {
  it("emits a focus request carrying the star id when focusStar is called", () => {
    const ctl = createFocusController();
    const seen: FocusRequest[] = [];
    ctl.subscribe((req) => seen.push(req));
    ctl.focusStar("s07");
    expect(seen).toEqual([{ kind: "focus", id: "s07" }]);
  });

  it("passes an optional zoom through on the focus request", () => {
    const ctl = createFocusController();
    const seen: FocusRequest[] = [];
    ctl.subscribe((req) => seen.push(req));
    ctl.focusStar("s07", 3);
    expect(seen).toEqual([{ kind: "focus", id: "s07", zoom: 3 }]);
  });

  it("emits a back request when back() is called (ESC / discovery 'back')", () => {
    const ctl = createFocusController();
    const seen: FocusRequest[] = [];
    ctl.subscribe((req) => seen.push(req));
    ctl.back();
    expect(seen).toEqual([{ kind: "back" }]);
  });

  it("fans out to every subscriber and stops after unsubscribe", () => {
    const ctl = createFocusController();
    const a: FocusRequest[] = [];
    const b: FocusRequest[] = [];
    const offA = ctl.subscribe((r) => a.push(r));
    ctl.subscribe((r) => b.push(r));
    ctl.focusStar("s1");
    offA();
    ctl.focusStar("s2");
    expect(a).toEqual([{ kind: "focus", id: "s1" }]);
    expect(b).toEqual([
      { kind: "focus", id: "s1" },
      { kind: "focus", id: "s2" },
    ]);
  });
});
