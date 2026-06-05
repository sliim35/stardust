import { describe, expect, it } from "vitest";
import type { Camera } from "#/lib/galaxy/camera";
import { createFocus, DEFAULT_FRAMING, stepFocus } from "#/lib/galaxy/focus";
import {
  clampCenter,
  INERTIA_DECAY,
  INERTIA_STOP,
  PAN_BOUNDS,
  panBoundsFor,
  panCamera,
  releaseVelocity,
  stepInertia,
} from "#/lib/galaxy/pan";
import { GALAXY_CENTER } from "#/lib/galaxy/place";

const cam = (cx: number, cy: number, zoom: number): Camera => ({
  cx,
  cy,
  zoom,
});

// --- AC1: drag moves the target by the (negated) pointer delta -------------
describe("panCamera — drag moves the camera target so the sky follows the finger", () => {
  it("shifts the target opposite the pointer delta (drag right → world moves left under the finger)", () => {
    const s0 = createFocus(cam(640, 400, 1));
    // The component passes the world-space delta the pointer travelled
    // (`screenToStage` of the move). Dragging the sky right means the grabbed
    // world point should stay under the cursor → the camera center moves left.
    const s1 = panCamera(s0, { x: 40, y: 25 });
    expect(s1.target.cx).toBe(640 - 40);
    expect(s1.target.cy).toBe(400 - 25);
    expect(s1.target.zoom).toBe(1); // pan never changes zoom
  });

  it("accumulates across successive drag deltas (off the live target)", () => {
    const s0 = createFocus(cam(640, 400, 1));
    const s1 = panCamera(s0, { x: 10, y: 0 });
    const s2 = panCamera(s1, { x: 10, y: 0 });
    expect(s2.target.cx).toBe(620);
  });

  it("does NOT snap current — the eased loop carries the move (focusing=true)", () => {
    const s0 = createFocus(cam(640, 400, 1));
    const s1 = panCamera(s0, { x: 40, y: 0 });
    expect(s1.current).toEqual(cam(640, 400, 1)); // RAF eases current→target
    expect(s1.focusing).toBe(true);
  });

  it("snaps current to the target under reduced motion (no ease)", () => {
    const s0 = createFocus(cam(640, 400, 1));
    const s1 = panCamera(s0, { x: 40, y: 0 }, true);
    expect(s1.current).toEqual(s1.target);
    expect(s1.focusing).toBe(false);
  });

  it("preserves prior so ESC/back is unaffected by a pan", () => {
    const s0 = { ...createFocus(cam(640, 400, 1)), prior: cam(640, 400, 1) };
    const s1 = panCamera(s0, { x: 40, y: 0 });
    expect(s1.prior).toEqual(cam(640, 400, 1));
  });

  it("is pure — does not mutate the prior state", () => {
    const s0 = createFocus(cam(640, 400, 1));
    panCamera(s0, { x: 40, y: 25 });
    expect(s0.target).toEqual(cam(640, 400, 1));
  });
});

// --- AC3: the panned target is clamped to galaxy bounds --------------------
describe("clampCenter — the camera center can't pan into the empty void", () => {
  it("leaves an in-bounds center untouched", () => {
    expect(clampCenter({ x: 640, y: 400 }, PAN_BOUNDS)).toEqual({
      x: 640,
      y: 400,
    });
  });

  it("clamps a center dragged past the right/bottom edge back to the bound", () => {
    const c = clampCenter({ x: 999_999, y: 999_999 }, PAN_BOUNDS);
    expect(c.x).toBe(PAN_BOUNDS.maxX);
    expect(c.y).toBe(PAN_BOUNDS.maxY);
  });

  it("clamps a center dragged past the left/top edge back to the bound", () => {
    const c = clampCenter({ x: -999_999, y: -999_999 }, PAN_BOUNDS);
    expect(c.x).toBe(PAN_BOUNDS.minX);
    expect(c.y).toBe(PAN_BOUNDS.minY);
  });

  it("PAN_BOUNDS centers on GALAXY_CENTER (you can always frame home)", () => {
    expect((PAN_BOUNDS.minX + PAN_BOUNDS.maxX) / 2).toBe(GALAXY_CENTER.x);
    expect((PAN_BOUNDS.minY + PAN_BOUNDS.maxY) / 2).toBe(GALAXY_CENTER.y);
  });
});

describe("panBoundsFor — at higher zoom you can pan less (the disk fills more)", () => {
  it("returns a tighter box as zoom increases (the void shrinks on screen)", () => {
    const wide = panBoundsFor(1);
    const tight = panBoundsFor(4);
    const span = (b: typeof wide) => b.maxX - b.minX;
    expect(span(tight)).toBeLessThan(span(wide));
  });

  it("always keeps the galaxy center reachable at any zoom", () => {
    for (const z of [0.8, 1, 1.8, 4]) {
      const b = panBoundsFor(z);
      expect(b.minX).toBeLessThanOrEqual(GALAXY_CENTER.x);
      expect(b.maxX).toBeGreaterThanOrEqual(GALAXY_CENTER.x);
    }
  });
});

describe("panCamera clamps the target to bounds (no panning into the void)", () => {
  it("a huge drag past the edge lands the target exactly on the bound", () => {
    const s0 = createFocus(cam(PAN_BOUNDS.maxX, 400, 1));
    const s1 = panCamera(s0, { x: -5000, y: 0 }); // drag world far right
    expect(s1.target.cx).toBe(PAN_BOUNDS.maxX); // can't go past
  });

  it("clamps at the higher-zoom (tighter) bound", () => {
    const z = 4;
    const b = panBoundsFor(z);
    const s0 = createFocus(cam(b.maxX, 400, z));
    const s1 = panCamera(s0, { x: -5000, y: 0 });
    expect(s1.target.cx).toBe(b.maxX);
  });
});

// --- AC2 / AC5: release velocity + eased inertia decay (not a hard stop) ----
describe("releaseVelocity — track the fling velocity at release", () => {
  it("derives velocity from the recent pointer movement (px / s, in world units)", () => {
    // delta over dt: 60 world-px in 0.1s → 600 px/s
    const v = releaseVelocity({ x: 60, y: -30 }, 0.1);
    expect(v).toEqual({ x: 600, y: -300 });
  });

  it("is zero for a zero-duration sample (no divide-by-zero blowup)", () => {
    expect(releaseVelocity({ x: 60, y: -30 }, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("stepInertia — release motion decays with eased inertia, not a hard stop", () => {
  it("decays the velocity exponentially each frame (strictly toward zero, never negative-flips)", () => {
    const v0 = { x: 600, y: 0 };
    const v1 = stepInertia(v0, 1 / 60);
    expect(v1.x).toBeLessThan(v0.x); // slowed
    expect(v1.x).toBeGreaterThan(0); // but still moving — NOT a hard stop
  });

  it("matches the exponential decay model so it eases out, frame-rate independent", () => {
    const v0 = { x: 600, y: 400 };
    const dt = 1 / 60;
    const v1 = stepInertia(v0, dt);
    const k = INERTIA_DECAY ** dt;
    expect(v1.x).toBeCloseTo(600 * k, 6);
    expect(v1.y).toBeCloseTo(400 * k, 6);
  });

  it("snaps to a dead stop only once it crosses the INERTIA_STOP threshold", () => {
    const tiny = { x: INERTIA_STOP * 0.5, y: 0 };
    expect(stepInertia(tiny, 1 / 60)).toEqual({ x: 0, y: 0 });
  });

  it("over many frames the velocity converges to zero (the fling settles)", () => {
    let v = { x: 1200, y: -800 };
    for (let i = 0; i < 600; i++) v = stepInertia(v, 1 / 60);
    expect(v).toEqual({ x: 0, y: 0 });
  });
});

describe("inertia fling drives the camera target, opposite the fling, through the eased loop", () => {
  it("a frame of inertia advances the target by velocity*dt, opposite the fling", () => {
    const s0 = createFocus(cam(640, 400, 1));
    // a fling moving the world +x at 600px/s → camera center eases the other way
    const s1 = panCamera(s0, { x: 600 * (1 / 60), y: 0 });
    expect(s1.target.cx).toBeCloseTo(640 - 10, 6);
  });

  it("reduced motion produces NO fling — a zeroed velocity never keeps moving", () => {
    // The hook drops inertia under reduce; a zeroed velocity is a no-op stop.
    expect(stepInertia({ x: 0, y: 0 }, 1 / 60)).toEqual({ x: 0, y: 0 });
    // …while the velocity itself is real, so the non-reduce path can fling.
    expect(releaseVelocity({ x: 60, y: -30 }, 0.1)).not.toEqual({ x: 0, y: 0 });
  });
});

// --- composition with the existing eased loop ------------------------------
describe("DEFAULT_FRAMING still frames home within the pan bounds", () => {
  it("the home center is inside PAN_BOUNDS at the home zoom", () => {
    const b = panBoundsFor(DEFAULT_FRAMING.zoom);
    expect(DEFAULT_FRAMING.cx).toBeGreaterThanOrEqual(b.minX);
    expect(DEFAULT_FRAMING.cx).toBeLessThanOrEqual(b.maxX);
    expect(DEFAULT_FRAMING.cy).toBeGreaterThanOrEqual(b.minY);
    expect(DEFAULT_FRAMING.cy).toBeLessThanOrEqual(b.maxY);
  });

  it("a panned + stepped move still settles (composes with stepFocus)", () => {
    const s0 = createFocus(cam(640, 400, 1));
    const panned = panCamera(s0, { x: 40, y: 25 });
    const settled = stepFocus(panned, 1);
    expect(settled.current).toEqual(panned.target);
    expect(settled.focusing).toBe(false);
  });
});
