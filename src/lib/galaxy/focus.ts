/**
 * The pure focus-on-star state machine (#111) — the shared camera primitive that
 * gates read deep-link (#5) and discovery search-select (#113). It owns the
 * *numbers* of a programmatic camera move: the current framing, the eased target,
 * whether a move is in flight, and the prior framing to return to on ESC/back.
 * The component owns the RAF loop + key/pointer events (mirrors `camera.ts`'s
 * "components own RAF + DOM; this module owns the numbers" contract), so the whole
 * machine is unit-testable headless.
 *
 * It composes — never forks — the existing `camera.ts` easing: `focusOn` builds a
 * target, `lerpCamera` eases toward it. Focusing never touches a star's `(r, angle)`,
 * so the append-only invariant holds: framing a star can't move any other star.
 */

import {
  type Camera,
  focusOn,
  lerpCamera,
  zoomToCursor,
} from "#/lib/galaxy/camera";
import { GALAXY_CENTER, type Point, polarToXY } from "#/lib/galaxy/place";
import type { GalaxySky } from "#/lib/galaxy/types";

/**
 * The zoomed-out "home" framing — galaxy centered at neutral zoom. ESC/back eases
 * here when there is no prior framing to restore (e.g. a deep-link that landed
 * straight on a star). Center is derived from `GALAXY_CENTER` (one source of
 * truth for the disk center); zoom is deliberately below the `focusOn` default
 * (1.8) so "back" always reads as a zoom-out.
 */
export const DEFAULT_FRAMING = {
  cx: GALAXY_CENTER.x,
  cy: GALAXY_CENTER.y,
  zoom: 1,
} as const satisfies Camera;

/** Sub-pixel / sub-zoom slop under which a move is considered settled. */
const ARRIVE_EPSILON = 0.01;

export type FocusState = {
  /** Where the camera is *now* (eased each frame toward `target`). */
  current: Camera;
  /** Where the camera is heading. `current === target` ⇒ at rest. */
  target: Camera;
  /** True while an eased move is in flight (drives the RAF loop in the component). */
  focusing: boolean;
  /** The framing to restore on ESC/back; `null` once consumed or never set. */
  prior: Camera | null;
};

/** A fresh, at-rest machine framed at `initial`. */
export const createFocus = (initial: Camera): FocusState => ({
  current: { ...initial },
  target: { ...initial },
  focusing: false,
  prior: null,
});

/**
 * Resolve a star id to an eased camera target via the sky's own placement
 * (`polarToXY` → `focusOn`). Returns `null` for an unknown id so callers (#5
 * `?star=`, #113 search) degrade gracefully without a throw.
 */
export const resolveFocusTarget = (
  sky: GalaxySky,
  id: string,
  zoom?: number,
): Camera | null => {
  const star = sky.stars.find((s) => s.id === id);
  if (!star) return null;
  return focusOn(polarToXY(star.r, star.angle), zoom);
};

/**
 * Start (or interrupt) an eased move toward `target`. A new focus while one is
 * in flight retargets from wherever `current` actually is — the in-flight move is
 * cancelled, never snapped — and keeps the *original* `prior` so ESC still returns
 * to where exploration began, not to the abandoned intermediate target.
 */
export const focusCamera = (state: FocusState, target: Camera): FocusState => ({
  current: { ...state.current },
  target: { ...target },
  focusing: true,
  // First focus records the resting framing; an interrupting focus preserves it.
  prior: state.focusing ? state.prior : { ...state.current },
});

/**
 * Wheel / pinch zoom (#110): retarget the eased move toward an anchored zoom so
 * the stage point under the cursor / pinch midpoint stays put. Composes — never
 * forks — the pure `zoomToCursor` (clamped to `ZOOM_MIN/MAX`), anchored on the
 * *target* so rapid ticks compound smoothly toward where the camera is heading
 * rather than fighting the in-flight ease (no jitter). `prior` is preserved so a
 * zoom never disturbs the ESC/back framing. Under reduced motion (`reduce`) the
 * move snaps: `current` lands on the new target immediately, the existing
 * reduced-motion pattern (no RAF). `anchor` is a camera-world `Point` — the
 * component converts the client event via `camera.ts`'s `screenToStage`.
 */
export const zoomCamera = (
  state: FocusState,
  anchor: Point,
  factor: number,
  reduce = false,
): FocusState => {
  const target = zoomToCursor(state.target, anchor, factor);
  return {
    current: reduce ? { ...target } : { ...state.current },
    target,
    focusing: !reduce,
    prior: state.prior,
  };
};

/**
 * Cancel an in-flight ease because the user grabbed the camera (drag-to-pan, #109).
 * The camera rests where the drag took over (`target := current`); `prior` is kept
 * so ESC/back still works after a manual nudge.
 */
export const cancelFocus = (state: FocusState): FocusState => ({
  current: { ...state.current },
  target: { ...state.current },
  focusing: false,
  prior: state.prior,
});

/**
 * ESC / "back": ease toward the saved `prior` framing, or the zoomed-out
 * `DEFAULT_FRAMING` when there is none. Consumes `prior` so a second back doesn't
 * bounce.
 */
export const back = (state: FocusState): FocusState => ({
  current: { ...state.current },
  target: { ...(state.prior ?? DEFAULT_FRAMING) },
  focusing: true,
  prior: null,
});

/** Whether `cur` is within an epsilon of `target` on every axis (move settled). */
export const isArrived = (cur: Camera, target: Camera): boolean =>
  Math.abs(cur.cx - target.cx) < ARRIVE_EPSILON &&
  Math.abs(cur.cy - target.cy) < ARRIVE_EPSILON &&
  Math.abs(cur.zoom - target.zoom) < ARRIVE_EPSILON;

/**
 * Advance the eased move one frame: `current` eases toward `target` by `t`
 * (`lerpCamera`). Under reduced motion the component passes `reduce = true`, which
 * drives `t = 1` — an instant snap, the existing reduced-motion pattern. Once
 * arrived, `current` lands exactly on `target` and `focusing` clears.
 */
export const stepFocus = (
  state: FocusState,
  t: number,
  reduce = false,
): FocusState => {
  const stepped = lerpCamera(state.current, state.target, reduce ? 1 : t);
  const arrived = reduce || isArrived(stepped, state.target);
  return {
    current: arrived ? { ...state.target } : stepped,
    target: { ...state.target },
    focusing: !arrived,
    prior: state.prior,
  };
};

/**
 * A focus request crossing the seam from a feature (read deep-link #5, search
 * #113) to the camera hook that owns the RAF loop. `focus` carries a star id (the
 * hook resolves it against the live sky via `resolveFocusTarget`); `back` is the
 * ESC / "back" gesture.
 */
export type FocusRequest =
  | { kind: "focus"; id: string; zoom?: number }
  | { kind: "back" };

/**
 * The focus-by-id seam: a tiny request channel other features call by id without
 * knowing anything about the camera, RAF, or DOM. The camera hook subscribes and
 * drives the `FocusState` machine; this keeps the data store (`store.ts`) free of
 * any view/animation state. SSR-safe — no module-scope state, clock, or random.
 */
export type FocusController = {
  /** Request an eased focus onto a star by id (resolved against the live sky). */
  focusStar(id: string, zoom?: number): void;
  /** Request a return to the prior framing (ESC / discovery "back"). */
  back(): void;
  /** Listen for requests; returns an unsubscribe. */
  subscribe(fn: (req: FocusRequest) => void): () => void;
};

export const createFocusController = (): FocusController => {
  const subscribers = new Set<(req: FocusRequest) => void>();
  const emit = (req: FocusRequest): void => {
    for (const fn of subscribers) fn(req);
  };
  return {
    focusStar: (id, zoom) =>
      emit(
        zoom === undefined
          ? { kind: "focus", id }
          : { kind: "focus", id, zoom },
      ),
    back: () => emit({ kind: "back" }),
    subscribe: (fn) => {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
};
