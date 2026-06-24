/**
 * Pure **spatial** camera math for the galaxy stage (#4): targets, transforms,
 * parallax and screen↔stage inversion. Components own the DOM, and GSAP owns
 * the time domain (ADR-0009) — it tweens *toward* the targets computed here;
 * the hand-rolled temporal stepping (`lerp` / `lerpCamera`) is retired. This
 * module owns the numbers, so every coordinate decision stays unit-testable
 * headless (`docs/design/2026-06-02-explorable-galaxy.md` §"Camera" + §"3-layer
 * parallax").
 *
 * The camera never snaps: the component layer eases every move (a GSAP tween).
 * Under reduced motion it snaps directly and passes `reduce` here to flatten
 * parallax.
 */

import { GALAXY_CENTER, type Point } from "#/lib/galaxy/place";
import { clamp } from "#/lib/galaxy/rng";

export type Vec = { x: number; y: number };
export type Camera = { cx: number; cy: number; zoom: number };
export type ParallaxOffsets = { l1: Vec; l2: Vec; l3: Vec; l4: Vec };

/**
 * Max parallax offset (px) at the viewport edge — nearest layer moves most. L4 is
 * the foreground figure plane (#243): the emotion figures + their member stars ride
 * it, so it parallaxes the MOST and reads as the nearest thing to the viewer. The
 * `l4` magnitude is the one tunable knob — `30` is a default; the final value is an
 * owner show-variants pick at QA.
 */
export const PARALLAX_MAX = { l1: 6, l2: 14, l3: 22, l4: 30 } as const;

/** Zoom clamps — you can never lose the disk. */
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 4;

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
 * nearest layer (L4 — the figure plane, #243) moving most so the emotion figures
 * read as floating above the loose memory stars (L3) and the disk.
 */
export const parallaxOffsets = (
  pointer: Vec,
  viewport: { w: number; h: number },
  reduce = false,
): ParallaxOffsets => {
  const zero = { x: 0, y: 0 };
  if (reduce)
    return {
      l1: { ...zero },
      l2: { ...zero },
      l3: { ...zero },
      l4: { ...zero },
    };
  const nx = clamp((pointer.x / viewport.w) * 2 - 1, -1, 1);
  const ny = clamp((pointer.y / viewport.h) * 2 - 1, -1, 1);
  const nz = (v: number): number => (v === 0 ? 0 : v); // squash -0 → 0
  const at = (m: number): Vec => ({ x: nz(-nx * m), y: nz(-ny * m) });
  return {
    l1: at(PARALLAX_MAX.l1),
    l2: at(PARALLAX_MAX.l2),
    l3: at(PARALLAX_MAX.l3),
    l4: at(PARALLAX_MAX.l4),
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
