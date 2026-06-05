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
import {
  panCamera,
  releaseVelocity,
  stepInertia,
  type Velocity,
} from "#/lib/galaxy/pan";
import { type Point, STAGE_W } from "#/lib/galaxy/place";
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
 * Drag-to-pan (#109) also folds into the same loop: a pointer-down grabs the sky
 * (cancelling any in-flight focus + pausing the idle drift), each move retargets
 * via the pure `panCamera` (world-space delta from `screenToStage`, clamped to the
 * galaxy bounds so you can't pan into the void), and on release the motion eases
 * out with `stepInertia` velocity decay (not a hard stop) — the same RAF advances
 * the fling target each frame. The idle sine drift resumes a short idle after the
 * interaction (drag + inertia) settles.
 *
 * Under `prefers-reduced-motion` the parallax/idle drift is pinned static and a
 * focus / zoom / pan *snaps* (drives `t = 1`) instead of easing, with NO inertia
 * fling on release (design spec §A11y).
 */

type CameraRefs = {
  l1: RefObject<HTMLDivElement | null>;
  l2: RefObject<HTMLDivElement | null>;
  l3: RefObject<HTMLDivElement | null>;
  cam: RefObject<HTMLDivElement | null>;
  /** The scene root — hosts the native wheel/touch zoom + pointer drag listeners. */
  stage: RefObject<HTMLDivElement | null>;
  /** The contain-fit box — its client rect maps wheel/pinch/drag px → stage space. */
  fit: RefObject<HTMLDivElement | null>;
  onPointerMove: (e: { clientX: number; clientY: number }) => void;
  onPointerLeave: () => void;
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

    // --- drag-to-pan + inertia (#109) --------------------------------------
    // A single pointer grabs the sky; each move retargets the focus machine via
    // the pure `panCamera` (world-space delta from `screenToStage`, clamped to the
    // galaxy bounds). On release the leftover velocity becomes an eased inertia
    // fling, stepped by the RAF below. Pointer Events unify mouse/touch/pen; a
    // second pointer (pinch) aborts the drag so the zoom path owns two fingers.
    // `interactUntil` keeps the idle drift paused through the drag + a short idle
    // grace after it (and the whole fling), then it resumes.
    const IDLE_GRACE_MS = 600;
    let interactUntil = 0;
    const bumpIdle = () => {
      interactUntil = performance.now() + IDLE_GRACE_MS;
    };
    let inertia: Velocity = { x: 0, y: 0 };
    const drag = {
      id: -1, // active pointerId, -1 when not dragging
      world: { x: 0, y: 0 }, // last pointer position in camera-world px
      lastDelta: { x: 0, y: 0 }, // last world step (for release velocity)
      lastMs: 0,
    };
    const toWorld = (client: { x: number; y: number }): Point | null => {
      const rect = stageRect();
      return rect
        ? screenToStage(client, rect, focusState.current.target)
        : null;
    };
    // #138: the cursor reads `grab` at rest and `grabbing` while a pan is in
    // flight. Drive it off a `data-dragging` attr on the stage root (CSS:
    // `.galaxy-stage[data-dragging] { cursor: grabbing }` in styles.css) rather
    // than `:active`, which would also fire on a plain click that never pans.
    const setDragging = (on: boolean) => {
      if (!root) return;
      if (on) root.setAttribute("data-dragging", "");
      else root.removeAttribute("data-dragging");
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return; // left button only
      if (drag.id !== -1) {
        // A second finger went down → this is a pinch, not a pan: abort the drag.
        drag.id = -1;
        setDragging(false);
        return;
      }
      const world = toWorld(e);
      if (!world) return;
      inertia = { x: 0, y: 0 }; // a fresh grab kills any in-flight fling
      // Grabbing the camera cancels an in-flight focus ease (#111 AC3 / #109).
      if (focusState.current.focusing)
        focusState.current = cancelFocus(focusState.current);
      drag.id = e.pointerId;
      drag.world = world;
      drag.lastDelta = { x: 0, y: 0 };
      drag.lastMs = performance.now();
      bumpIdle();
      setDragging(true);
      root?.setPointerCapture?.(e.pointerId);
    };
    const onPointerMoveDrag = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      const world = toWorld(e);
      if (!world) return;
      // World-space delta the finger travelled this move; pan moves the camera
      // the *opposite* way so the grabbed point stays under the finger.
      const delta = { x: world.x - drag.world.x, y: world.y - drag.world.y };
      focusState.current = panCamera(focusState.current, delta, reduce);
      if (reduce) applyCamera(focusState.current.current); // no RAF — paint now
      // Re-read the world point AFTER the pan retarget so the next delta is
      // measured from where the grabbed point now sits (clamp-aware, no runaway).
      drag.world = toWorld(e) ?? world;
      drag.lastDelta = delta;
      drag.lastMs = performance.now();
      bumpIdle();
    };
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      drag.id = -1;
      setDragging(false); // back to `grab` (before the reduce early-return below)
      root?.releasePointerCapture?.(e.pointerId);
      bumpIdle();
      // Inertia: fling the leftover velocity (world px/s) from the last move.
      // Reduced motion gets NO fling — it stops on release (snap path above).
      if (reduce) return;
      const dt = (performance.now() - drag.lastMs) / 1000;
      inertia =
        dt > 0 && dt < 0.1
          ? releaseVelocity(drag.lastDelta, dt)
          : { x: 0, y: 0 };
    };

    const root = stage.current;
    root?.addEventListener("wheel", onWheel, { passive: false });
    root?.addEventListener("touchstart", onTouchStart); // passive (default): onTouchStart never preventDefaults
    root?.addEventListener("touchmove", onTouchMove, { passive: false });
    root?.addEventListener("touchend", onTouchEnd);
    root?.addEventListener("touchcancel", onTouchEnd);
    root?.addEventListener("pointerdown", onPointerDown);
    root?.addEventListener("pointermove", onPointerMoveDrag);
    root?.addEventListener("pointerup", endDrag);
    root?.addEventListener("pointercancel", endDrag);
    const detachZoom = () => {
      root?.removeEventListener("wheel", onWheel);
      root?.removeEventListener("touchstart", onTouchStart);
      root?.removeEventListener("touchmove", onTouchMove);
      root?.removeEventListener("touchend", onTouchEnd);
      root?.removeEventListener("touchcancel", onTouchEnd);
      root?.removeEventListener("pointerdown", onPointerDown);
      root?.removeEventListener("pointermove", onPointerMoveDrag);
      root?.removeEventListener("pointerup", endDrag);
      root?.removeEventListener("pointercancel", endDrag);
    };

    if (reduce) {
      // Static parallax; focus + zoom + pan requests above snap. No RAF, no fling.
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

    let prevMs = performance.now();
    const frame = (ms: number) => {
      const t = ms * 0.001;
      const dt = Math.min((ms - prevMs) / 1000, 0.1); // clamp tab-switch hitches
      prevMs = ms;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Idle sine drift only when the pointer is away AND no recent interaction
      // (drag/inertia) — a drag/fling pauses the drift, which resumes a short idle
      // (`IDLE_GRACE_MS`) after the interaction settles (#109 AC4).
      const idle = !pointer.current.active && ms > interactUntil;
      const px = idle
        ? vw * (0.5 + Math.sin(t * 0.16) * 0.12)
        : pointer.current.x;
      const py = idle
        ? vh * (0.5 + Math.cos(t * 0.12) * 0.1)
        : pointer.current.y;
      const tgt = parallaxOffsets({ x: px, y: py }, { w: vw, h: vh });

      for (const key of ["l1", "l2", "l3"] as const) {
        cur[key].x += (tgt[key].x - cur[key].x) * 0.06;
        cur[key].y += (tgt[key].y - cur[key].y) * 0.06;
        const el = els[key].current;
        if (el)
          el.style.transform = `translate3d(${cur[key].x}px, ${cur[key].y}px, 0)`;
      }

      // Inertia fling (#109): decay the release velocity (eased, not a hard stop)
      // and drive the pan target by velocity·dt each frame, clamped to bounds.
      if (inertia.x !== 0 || inertia.y !== 0) {
        inertia = stepInertia(inertia, dt);
        focusState.current = panCamera(focusState.current, {
          x: inertia.x * dt,
          y: inertia.y * dt,
        });
        bumpIdle();
      }

      // Step the focus ease (intro settle, then any requested focus/back/pan) and
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
  };
};
