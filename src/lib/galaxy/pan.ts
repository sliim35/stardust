/**
 * Pure drag-to-pan + inertia math for the galaxy stage (#109) — the last nav
 * primitive (epic #7 Navigation). The visitor grabs the sky and drags; on release
 * the motion eases out with inertia rather than hard-stopping; the camera center
 * is clamped to galaxy-extent bounds so you can never pan into the empty void.
 *
 * Mirrors the `camera.ts` / `focus.ts` contract: **components own the RAF loop +
 * pointer events; this module owns the numbers** — so the pan, the velocity decay,
 * and the bounds clamp are all unit-testable headless. It *composes*, never forks,
 * the existing eased loop: `panCamera` retargets the same `FocusState` machine
 * (driven by `stepFocus`), exactly like `zoomCamera` does for #110.
 *
 * The pointer delta the component passes is already in **camera-world units** (it
 * inverts the client move via `camera.ts`'s `screenToStage`), so a drag keeps the
 * grabbed world point under the finger: the center moves *opposite* the drag.
 */

import type { Camera } from "#/lib/galaxy/camera";
import { type FocusState, focusCamera } from "#/lib/galaxy/focus";
import {
  DISK_TILT,
  GALAXY_CENTER,
  GALAXY_R,
  type Point,
} from "#/lib/galaxy/place";
import { clamp } from "#/lib/galaxy/rng";

/** An axis-aligned box the camera center may roam — outside it lies the void. */
export type PanBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/**
 * How far (in world px) the camera center may roam from `GALAXY_CENTER` at zoom 1,
 * before it would frame pure void. Symmetric around the disk center: the full disk
 * radius in x, foreshortened by `DISK_TILT` in y (the disk reads as tilted away),
 * so the edge of the box sits at the edge of the painted disk — pan to the rim,
 * never past it.
 */
const PAN_HALF_X = GALAXY_R;
const PAN_HALF_Y = GALAXY_R * DISK_TILT;

/** The zoom-1 pan box (widest). Higher zoom tightens it — see `panBoundsFor`. */
export const PAN_BOUNDS = {
  minX: GALAXY_CENTER.x - PAN_HALF_X,
  maxX: GALAXY_CENTER.x + PAN_HALF_X,
  minY: GALAXY_CENTER.y - PAN_HALF_Y,
  maxY: GALAXY_CENTER.y + PAN_HALF_Y,
} as const satisfies PanBounds;

/**
 * The pan box at a given `zoom`. As you zoom in the disk fills more of the screen,
 * so less void is reachable — the half-extent shrinks inversely with zoom. The box
 * always contains `GALAXY_CENTER` (extent > 0 for any finite zoom), so home is
 * always reachable at any zoom.
 */
export const panBoundsFor = (zoom: number): PanBounds => {
  const hx = PAN_HALF_X / zoom;
  const hy = PAN_HALF_Y / zoom;
  return {
    minX: GALAXY_CENTER.x - hx,
    maxX: GALAXY_CENTER.x + hx,
    minY: GALAXY_CENTER.y - hy,
    maxY: GALAXY_CENTER.y + hy,
  };
};

/** Clamp a camera center to a pan box — the guard against panning into the void. */
export const clampCenter = (center: Point, bounds: PanBounds): Point => ({
  x: clamp(center.x, bounds.minX, bounds.maxX),
  y: clamp(center.y, bounds.minY, bounds.maxY),
});

/**
 * Drag-to-pan (#109): shift the camera target by the world-space pointer `delta`,
 * *opposite* the drag so the grabbed world point stays under the finger, then clamp
 * the new center to `panBoundsFor(zoom)`. Retargets the same eased `FocusState`
 * machine via `focusCamera` (composes — never forks — the existing ease): the RAF
 * eases `current → target` so the sky follows smoothly. Under reduced motion
 * (`reduce`) the move snaps (`current` lands on the target immediately, no RAF), the
 * existing reduced-motion pattern. `prior` is preserved so a pan never disturbs the
 * ESC/back framing.
 */
export const panCamera = (
  state: FocusState,
  delta: Point,
  reduce = false,
): FocusState => {
  const center = clampCenter(
    { x: state.target.cx - delta.x, y: state.target.cy - delta.y },
    panBoundsFor(state.target.zoom),
  );
  const target: Camera = {
    cx: center.x,
    cy: center.y,
    zoom: state.target.zoom,
  };
  const next = focusCamera(state, target);
  if (!reduce) return next;
  // No RAF under reduced motion: snap current onto the target, not focusing.
  return {
    current: { ...target },
    target,
    focusing: false,
    prior: next.prior,
  };
};

/** A pan/fling velocity in world px per second. */
export type Velocity = { x: number; y: number };

/**
 * Cap on release speed (world px / s). A fast flick otherwise computes a huge
 * `delta/dt` and flings the camera clear across the disk to the bounds; clamping the
 * release magnitude keeps the throw controlled (a flick travels ≈ `v / ln(1/DECAY)`
 * px, so 700 ⇒ ~120 px of glide — a calm pan, not a slingshot to the rim).
 */
export const MAX_RELEASE_VELOCITY = 700;

/**
 * Release velocity (world px / s) from the last drag sample: the world-space
 * `delta` the pointer travelled over `dt` seconds, **clamped to
 * `MAX_RELEASE_VELOCITY`** (direction preserved) so a quick flick can't slingshot
 * across the disk. A zero/negative `dt` yields a dead-zero velocity (no
 * divide-by-zero blow-up), so a stationary release can't fling.
 */
export const releaseVelocity = (delta: Point, dt: number): Velocity => {
  if (dt <= 0) return { x: 0, y: 0 };
  const raw = { x: delta.x / dt, y: delta.y / dt };
  const speed = Math.hypot(raw.x, raw.y);
  if (speed <= MAX_RELEASE_VELOCITY) return raw;
  const k = MAX_RELEASE_VELOCITY / speed;
  return { x: raw.x * k, y: raw.y * k };
};

/**
 * Per-second multiplicative decay of the inertia velocity. `< 1` so the fling
 * *eases out* (exponential, frame-rate independent) rather than hard-stopping —
 * each second retains this fraction of the speed.
 */
export const INERTIA_DECAY = 0.0025;

/** Speed (world px / s) below which the fling snaps to a dead stop. */
export const INERTIA_STOP = 4;

/**
 * Advance the inertia velocity one frame of `dt` seconds: exponential decay so the
 * release eases out, frame-rate independent (`v · DECAY^dt`). Once the speed crosses
 * `INERTIA_STOP` it snaps to a dead stop — a finite settle, not an asymptote that
 * jitters forever.
 */
export const stepInertia = (v: Velocity, dt: number): Velocity => {
  const k = INERTIA_DECAY ** dt;
  const next = { x: v.x * k, y: v.y * k };
  return Math.hypot(next.x, next.y) < INERTIA_STOP ? { x: 0, y: 0 } : next;
};
