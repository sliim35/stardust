import { type RefObject, useEffect, useRef } from "react";
import {
  type Camera,
  cameraTransform,
  parallaxOffsets,
  type StageRect,
  screenToStage,
  wheelZoomFactor,
} from "#/lib/galaxy/camera";
import {
  back,
  cancelFocus,
  createFocus,
  DEFAULT_FRAMING,
  type FocusController,
  type FocusState,
  focusCamera,
  resolveFocusTarget,
  stepFocus,
  zoomCamera,
} from "#/lib/galaxy/focus";
import { STAGE_W } from "#/lib/galaxy/place";
import type { GalaxySky } from "#/lib/galaxy/types";

/**
 * Drives the eased camera + 3-layer parallax (#4 AC5) and the focus-on-star move
 * (#111) imperatively via refs, so the RAF loop never re-renders React. The scene
 * drifts gently opposite the pointer (and on a slow idle sine when the pointer is
 * away); the nearest layer moves most.
 *
 * Focus (#111) is the pure `FocusState` machine from `lib/galaxy/focus` stepped
 * here each frame — this hook owns RAF + key/pointer events, the lib owns the
 * numbers. A `FocusController` lets other features (#5 deep-link, #113 search)
 * request a focus *by star id*; the id is resolved against the live sky via
 * `getSky()`. The ease is interruptible: a new focus retargets in flight, and a
 * user pointer-drag cancels it (drag-to-pan lands in #109). `Escape` returns to
 * the prior framing (or the zoomed-out default).
 *
 * Zoom-to-cursor (#110) folds into the SAME eased loop: wheel + two-finger pinch
 * retarget the focus machine via `zoomCamera` (pure `zoomToCursor`, anchored at
 * the cursor / pinch midpoint, clamped), and the RAF eases `current → target` —
 * no new easing math. Client coords are inverted to camera-world via
 * `screenToStage` using the live contain-fit rect (`fit` ref), so the anchored
 * point stays put. Wheel/touch listeners are attached natively (non-passive) so
 * the gesture can `preventDefault` page scroll / browser pinch-zoom.
 *
 * Under `prefers-reduced-motion` the parallax/idle drift is pinned static and a
 * focus / zoom *snaps* (drives `t = 1`) instead of easing (design spec §A11y).
 */

type CameraRefs = {
  l1: RefObject<HTMLDivElement | null>;
  l2: RefObject<HTMLDivElement | null>;
  l3: RefObject<HTMLDivElement | null>;
  cam: RefObject<HTMLDivElement | null>;
  /** The scene root — hosts the native (non-passive) wheel/touch zoom listeners. */
  stage: RefObject<HTMLDivElement | null>;
  /** The contain-fit box — its client rect maps wheel/pinch px → stage space. */
  fit: RefObject<HTMLDivElement | null>;
  onPointerMove: (e: { clientX: number; clientY: number }) => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
};

type Options = {
  /** The focus-by-id seam other features call (#5/#113). */
  focus?: FocusController;
  /** Reads the current sky so a focus request resolves its star's position live. */
  getSky?: () => GalaxySky;
};

export const useGalaxyCamera = (options: Options = {}): CameraRefs => {
  const l1 = useRef<HTMLDivElement>(null);
  const l2 = useRef<HTMLDivElement>(null);
  const l3 = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fit = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, active: false });

  // Keep the latest controller/getSky without re-subscribing the RAF effect.
  const optsRef = useRef(options);
  optsRef.current = options;

  // The focus machine lives in a ref: stepped by RAF (or snapped under reduce),
  // never via React state, so a focus move costs zero re-renders.
  const focusState = useRef<FocusState>(createFocus(DEFAULT_FRAMING));

  useEffect(() => {
    // Read once at mount. A *mid-session* OS toggle of reduced-motion is not
    // honored here (nor in DeepStarfield / GalaxyBackdrop) — a known #4
    // limitation (review F2); initial load is correct. Revisit if needed.
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const applyCamera = (c: Camera) => {
      if (cam.current) cam.current.style.transform = cameraTransform(c);
    };

    // Intro settle on load — a visible "no snap" demonstration (eases 1.06 → 1.0).
    // `focusing` stays false: the RAF eases any current→target gap regardless of
    // the flag, so the settle still animates, but it is NOT a focus move — a stray
    // pointer-down during the first second must not `cancelFocus` and strand the
    // zoom mid-settle (the flag only guards real star-focus interrupts).
    if (!reduce) {
      focusState.current = {
        ...createFocus({ ...DEFAULT_FRAMING, zoom: 1.06 }),
        target: { ...DEFAULT_FRAMING },
      };
    }
    applyCamera(focusState.current.current);

    // --- focus-by-id seam (#5/#113) ----------------------------------------
    const requestFocus = (id: string, zoom?: number) => {
      const sky = optsRef.current.getSky?.();
      const target = sky ? resolveFocusTarget(sky, id, zoom) : null;
      if (!target) return; // unknown id degrades gracefully (no throw, no move)
      focusState.current = focusCamera(focusState.current, target);
      if (reduce) {
        // No RAF under reduced motion: snap to the target immediately.
        focusState.current = stepFocus(focusState.current, 1, true);
        applyCamera(focusState.current.current);
      }
    };
    const requestBack = () => {
      focusState.current = back(focusState.current);
      if (reduce) {
        focusState.current = stepFocus(focusState.current, 1, true);
        applyCamera(focusState.current.current);
      }
    };
    const unsubscribe = optsRef.current.focus?.subscribe((req) => {
      if (req.kind === "focus") requestFocus(req.id, req.zoom);
      else requestBack();
    });

    // ESC / "back" — return to the prior framing (or zoomed-out default).
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestBack();
    };
    window.addEventListener("keydown", onKeyDown);

    // --- zoom-to-cursor (#110): wheel + two-finger pinch -------------------
    // Both gestures retarget the focus machine via `zoomCamera`; the RAF eases
    // current→target (under reduce we snap here, since there is no RAF). The
    // anchor is converted client→world off the *target* camera so repeated ticks
    // compound jitter-free toward where the camera is heading.
    const stageRect = (): StageRect | null => {
      const el = fit.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, scale: r.width / STAGE_W };
    };
    const applyZoom = (client: { x: number; y: number }, factor: number) => {
      if (factor === 1) return;
      const rect = stageRect();
      if (!rect) return;
      const anchor = screenToStage(client, rect, focusState.current.target);
      focusState.current = zoomCamera(
        focusState.current,
        anchor,
        factor,
        reduce,
      );
      if (reduce) applyCamera(focusState.current.current); // no RAF — paint now
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // own the gesture: no page scroll while zooming
      applyZoom({ x: e.clientX, y: e.clientY }, wheelZoomFactor(e.deltaY));
    };

    // Pinch: track the two-finger span; each move zooms by the span ratio,
    // anchored at the midpoint. A single touch is left for pan (#109).
    let pinchPrev = 0;
    const span = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    });
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinchPrev = span(e.touches);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchPrev === 0) return;
      e.preventDefault(); // own the pinch: no browser page-zoom
      const next = span(e.touches);
      applyZoom(mid(e.touches), next / pinchPrev);
      pinchPrev = next;
    };
    const onTouchEnd = (e: TouchEvent) => {
      // Re-arm the span when a finger lifts/lands so a 2→1→2 sequence is smooth.
      pinchPrev = e.touches.length === 2 ? span(e.touches) : 0;
    };

    const root = stage.current;
    root?.addEventListener("wheel", onWheel, { passive: false });
    root?.addEventListener("touchstart", onTouchStart); // passive (default): onTouchStart never preventDefaults
    root?.addEventListener("touchmove", onTouchMove, { passive: false });
    root?.addEventListener("touchend", onTouchEnd);
    root?.addEventListener("touchcancel", onTouchEnd);
    const detachZoom = () => {
      root?.removeEventListener("wheel", onWheel);
      root?.removeEventListener("touchstart", onTouchStart);
      root?.removeEventListener("touchmove", onTouchMove);
      root?.removeEventListener("touchend", onTouchEnd);
      root?.removeEventListener("touchcancel", onTouchEnd);
    };

    if (reduce) {
      // Static parallax; focus + zoom requests above snap. No RAF to run.
      return () => {
        unsubscribe?.();
        window.removeEventListener("keydown", onKeyDown);
        detachZoom();
      };
    }

    const cur = {
      l1: { x: 0, y: 0 },
      l2: { x: 0, y: 0 },
      l3: { x: 0, y: 0 },
    };
    const els = { l1, l2, l3 } as const;
    let raf = 0;

    const frame = (ms: number) => {
      const t = ms * 0.001;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Idle sine drift when the pointer is away; the pointer takes over on move.
      const px = pointer.current.active
        ? pointer.current.x
        : vw * (0.5 + Math.sin(t * 0.16) * 0.12);
      const py = pointer.current.active
        ? pointer.current.y
        : vh * (0.5 + Math.cos(t * 0.12) * 0.1);
      const tgt = parallaxOffsets({ x: px, y: py }, { w: vw, h: vh });

      for (const key of ["l1", "l2", "l3"] as const) {
        cur[key].x += (tgt[key].x - cur[key].x) * 0.06;
        cur[key].y += (tgt[key].y - cur[key].y) * 0.06;
        const el = els[key].current;
        if (el)
          el.style.transform = `translate3d(${cur[key].x}px, ${cur[key].y}px, 0)`;
      }

      // Step the focus ease (intro settle, then any requested focus/back) and
      // paint the camera. lerpCamera factor matches the prior intro feel.
      focusState.current = stepFocus(focusState.current, 0.05);
      applyCamera(focusState.current.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe?.();
      window.removeEventListener("keydown", onKeyDown);
      detachZoom();
    };
  }, []);

  return {
    l1,
    l2,
    l3,
    cam,
    stage,
    fit,
    onPointerMove: (e) => {
      pointer.current = { x: e.clientX, y: e.clientY, active: true };
    },
    onPointerLeave: () => {
      pointer.current.active = false;
    },
    // A user grabbing the camera cancels any in-flight focus ease (#111 AC3).
    // Drag-to-pan proper is #109; this is the minimal interrupt hook it extends.
    onPointerDown: () => {
      if (focusState.current.focusing)
        focusState.current = cancelFocus(focusState.current);
    },
  };
};
