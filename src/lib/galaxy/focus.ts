/**
 * The pure focus-on-star state machine (#111) — the shared camera primitive that
 * gates read deep-link (#5) and discovery search-select (#113). It owns the
 * *spatial decisions* of a programmatic camera move: the eased target, whether a
 * move is in flight, and the prior framing to return to on ESC/back. The
 * component owns the DOM + key/pointer events and the **time domain** — GSAP
 * tweens toward the targets this machine computes (ADR-0009; the hand-rolled
 * `stepFocus`/`lerpCamera` stepping is retired) — so the whole machine stays
 * unit-testable headless.
 *
 * It composes — never forks — the `camera.ts` target math: `focusOn` builds a
 * target; the component layer eases toward it. Focusing never touches a star's
 * `(r, angle)`, so the append-only invariant holds: framing a star can't move
 * any other star.
 */

import { type Camera, focusOn } from "#/lib/galaxy/camera";
import { DISK_TILT, GALAXY_CENTER, polarToXY } from "#/lib/galaxy/place";
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

export type FocusState = {
  /** Where the camera is *now*. The hook owning the live (GSAP-tweened) camera
   * syncs this at each request boundary; between requests it may lag. */
  current: Camera;
  /** Where the camera is heading. `current === target` ⇒ at rest. */
  target: Camera;
  /** True while an eased move is in flight (cleared by the tween's completion). */
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
 * (`polarToXY` → `focusOn`). `tilt` MUST be the displayed galaxy's interior tilt —
 * the same one the star is rendered with — or the camera frames a point offset from
 * the visible star inside a tilted neighbour (M31 0.42 / M33 0.9); defaults to the
 * home `DISK_TILT` (#234). Returns `null` for an unknown id so callers (#5 `?star=`,
 * #113 search) degrade gracefully without a throw.
 */
export const resolveFocusTarget = (
  sky: GalaxySky,
  id: string,
  zoom?: number,
  tilt: number = DISK_TILT,
): Camera | null => {
  const star = sky.stars.find((s) => s.id === id);
  if (!star) return null;
  return focusOn(polarToXY(star.r, star.angle, tilt), zoom);
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
