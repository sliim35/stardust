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

import { GALAXY_CENTER, type Point } from "#/lib/galaxy/place";
import { clamp } from "#/lib/galaxy/rng";

export type Vec = { x: number; y: number };
export type Camera = { cx: number; cy: number; zoom: number };
export type ParallaxOffsets = { l1: Vec; l2: Vec; l3: Vec };

/** Max parallax offset (px) at the viewport edge — nearest layer moves most. */
export const PARALLAX_MAX = { l1: 6, l2: 14, l3: 22 } as const;

/** Zoom clamps — you can never lose the disk. */
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 4;

/** Scalar ease. `t=0` → `a`, `t=1` → `b`, in between → strictly between. */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** Ease a whole camera toward a target (used each RAF frame). */
export const lerpCamera = (cur: Camera, target: Camera, t: number): Camera => ({
  cx: lerp(cur.cx, target.cx, t),
  cy: lerp(cur.cy, target.cy, t),
  zoom: lerp(cur.zoom, target.zoom, t),
});

/**
 * A `Camera` → CSS `transform` for `.galaxy-stage__camera` (`transform-origin:
 * center center`, i.e. the stage center `GALAXY_CENTER`). `scale(zoom)` then a
 * `translate` that slides the focused world point `(cx, cy)` to the stage center,
 * so the resting home framing (`GALAXY_CENTER`, zoom 1) is the identity. The
 * translate is rounded to whole pixels to dodge the SSR/CSSOM sub-pixel rounding
 * mismatch (memory: round inline transform floats — CSSOM rounds, React doesn't).
 */
export const cameraTransform = (cam: Camera): string => {
  const dx = Math.round(GALAXY_CENTER.x - cam.cx);
  const dy = Math.round(GALAXY_CENTER.y - cam.cy);
  return `scale(${cam.zoom}) translate(${dx}px, ${dy}px)`;
};

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
 * The contain-fit rect of the logical stage in client space: the top-left of
 * `.galaxy-stage__fit` and its uniform `scale` (`useStageFit`). Used to invert a
 * client point back into camera-world coordinates for the tier transitions (later
 * waves) that anchor on a clicked point.
 */
export type StageRect = { left: number; top: number; scale: number };

/**
 * Invert a client-space point into the camera's world space — so a clicked point
 * maps to its stage-world coordinate (the anchor later tier transitions need).
 * Two inversions, matching the DOM stack:
 *   1. undo the contain-fit (`.galaxy-stage__fit` `scale`) → logical stage px,
 *   2. undo the camera transform (`scale(zoom)` about `GALAXY_CENTER`, then the
 *      `(cx, cy)` recenter) → world px.
 * The logical stage center always shows the camera center, so a fit-local offset
 * `d` from `GALAXY_CENTER` maps to `d / zoom` world px from `(cx, cy)`.
 */
export const screenToStage = (
  client: Point,
  rect: StageRect,
  cam: Camera,
): Point => {
  const fitX = (client.x - rect.left) / rect.scale;
  const fitY = (client.y - rect.top) / rect.scale;
  return {
    x: cam.cx + (fitX - GALAXY_CENTER.x) / cam.zoom,
    y: cam.cy + (fitY - GALAXY_CENTER.y) / cam.zoom,
  };
};
