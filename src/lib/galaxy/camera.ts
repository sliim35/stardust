/**
 * Pure camera math for the eased zoom / pan / parallax of the galaxy stage (#4).
 * Components own the RAF loop and the DOM; this module owns the numbers, so the
 * easing and the 3-layer parallax are unit-testable headless
 * (`docs/design/2026-06-02-explorable-galaxy.md` §"Camera" + §"3-layer parallax").
 *
 * The camera never snaps: every move is an eased `lerp` toward a target. Under
 * reduced motion the hook drives `t = 1` (instant) and passes `reduce` here to
 * flatten parallax.
 */

import type { Point } from "#/lib/galaxy/place";

export type Vec = { x: number; y: number };
export type Camera = { cx: number; cy: number; zoom: number };
export type ParallaxOffsets = { l1: Vec; l2: Vec; l3: Vec };

/** Max parallax offset (px) at the viewport edge — nearest layer moves most. */
export const PARALLAX_MAX = { l1: 6, l2: 14, l3: 22 } as const;

/** Zoom clamps — you can never lose the disk. */
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 4;

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Scalar ease. `t=0` → `a`, `t=1` → `b`, in between → strictly between. */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** Ease a whole camera toward a target (used each RAF frame). */
export const lerpCamera = (cur: Camera, target: Camera, t: number): Camera => ({
  cx: lerp(cur.cx, target.cx, t),
  cy: lerp(cur.cy, target.cy, t),
  zoom: lerp(cur.zoom, target.zoom, t),
});

/** Target camera centered on a stage position (selection / `?star=` deep-link). */
export const focusOn = (pos: Point, zoom = 1.8): Camera => ({
  cx: pos.x,
  cy: pos.y,
  zoom,
});

/**
 * Per-layer parallax offsets for a pointer position. The scene shifts *opposite*
 * the pointer; magnitude grows to `PARALLAX_MAX` at the viewport edge, with the
 * nearest layer (L3) moving most so memory stars read as floating above the disk.
 */
export const parallaxOffsets = (
  pointer: Vec,
  viewport: { w: number; h: number },
  reduce = false,
): ParallaxOffsets => {
  const zero = { x: 0, y: 0 };
  if (reduce) return { l1: { ...zero }, l2: { ...zero }, l3: { ...zero } };
  const nx = clamp((pointer.x / viewport.w) * 2 - 1, -1, 1);
  const ny = clamp((pointer.y / viewport.h) * 2 - 1, -1, 1);
  const nz = (v: number): number => (v === 0 ? 0 : v); // squash -0 → 0
  const at = (m: number): Vec => ({ x: nz(-nx * m), y: nz(-ny * m) });
  return {
    l1: at(PARALLAX_MAX.l1),
    l2: at(PARALLAX_MAX.l2),
    l3: at(PARALLAX_MAX.l3),
  };
};

/**
 * Zoom toward a stage-space cursor by `factor`, clamped. The point under the
 * cursor stays put: the center eases toward the cursor in proportion to the
 * actual (post-clamp) zoom change.
 */
export const zoomToCursor = (
  cam: Camera,
  cursor: Point,
  factor: number,
  min = ZOOM_MIN,
  max = ZOOM_MAX,
): Camera => {
  const zoom = clamp(cam.zoom * factor, min, max);
  const k = zoom === 0 ? 0 : 1 - cam.zoom / zoom; // >0 zooming in, <0 zooming out
  return {
    cx: cam.cx + (cursor.x - cam.cx) * k,
    cy: cam.cy + (cursor.y - cam.cy) * k,
    zoom,
  };
};
