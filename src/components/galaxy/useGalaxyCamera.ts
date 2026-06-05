import { type RefObject, useEffect, useRef } from "react";
import {
  type Camera,
  cameraTransform,
  parallaxOffsets,
} from "#/lib/galaxy/camera";
import {
  back,
  createFocus,
  DEFAULT_FRAMING,
  type FocusController,
  type FocusState,
  focusCamera,
  resolveFocusTarget,
  stepFocus,
} from "#/lib/galaxy/focus";
import type { GalaxySky } from "#/lib/galaxy/types";

/**
 * Drives the eased camera + 3-layer parallax (#4 AC5) and the focus-on-star move
 * (#111) imperatively via refs, so the RAF loop never re-renders React. The scene
 * drifts gently opposite the pointer (and on a slow idle sine when the pointer is
 * away); the nearest layer moves most.
 *
 * Focus (#111) is the pure `FocusState` machine from `lib/galaxy/focus` stepped
 * here each frame — this hook owns RAF + key events, the lib owns the numbers. A
 * `FocusController` lets other features (#5 deep-link, #113 search) request a
 * focus *by star id*; the id is resolved against the live sky via `getSky()`. The
 * ease is interruptible: a new focus retargets in flight. `Escape` returns to the
 * prior framing (or the zoomed-out default).
 *
 * The galaxy is **guided, not free** (interaction spec, 2026-06-05): there is NO
 * drag-to-pan (#109, retired) and NO free wheel/pinch zoom-to-cursor (#110,
 * retired). Within a tier the framing is fixed — only the gentle idle drift /
 * parallax and the eased focus moves animate it; scroll becomes discrete
 * tier-zoom in a later wave, not a continuous pointer-driven zoom.
 *
 * Under `prefers-reduced-motion` the parallax/idle drift is pinned static and a
 * focus *snaps* (drives `t = 1`) instead of easing (design spec §A11y).
 */

type CameraRefs = {
  l1: RefObject<HTMLDivElement | null>;
  l2: RefObject<HTMLDivElement | null>;
  l3: RefObject<HTMLDivElement | null>;
  cam: RefObject<HTMLDivElement | null>;
  /** The scene root. */
  stage: RefObject<HTMLDivElement | null>;
  /** The contain-fit box (carries `--stage-scale`); later tier transitions map
   * client px → stage space off its client rect. */
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

    if (reduce) {
      // Static parallax; focus / back requests above snap. No RAF.
      return () => {
        unsubscribe?.();
        window.removeEventListener("keydown", onKeyDown);
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
      // Idle sine drift only when the pointer is away; the pointer drives the
      // parallax while it is over the stage.
      const idle = !pointer.current.active;
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
