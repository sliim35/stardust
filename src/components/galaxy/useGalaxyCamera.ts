import { type RefObject, useEffect, useRef } from "react";
import { type Camera, lerpCamera, parallaxOffsets } from "#/lib/galaxy/camera";
import { GALAXY_CENTER } from "#/lib/galaxy/place";

/**
 * Drives the eased camera + 3-layer parallax (#4 AC5) imperatively via refs, so
 * the RAF loop never re-renders React. The scene drifts gently opposite the
 * pointer (and on a slow idle sine when the pointer is away); the nearest layer
 * moves most. The camera eases a small intro settle on load — a visible "no
 * snap" demonstration — and `lerpCamera` is the same pure easing proven in
 * `camera.test.ts`.
 *
 * Under `prefers-reduced-motion` everything is pinned static (design spec §A11y).
 */

type CameraRefs = {
  l1: RefObject<HTMLDivElement | null>;
  l2: RefObject<HTMLDivElement | null>;
  l3: RefObject<HTMLDivElement | null>;
  cam: RefObject<HTMLDivElement | null>;
  onPointerMove: (e: { clientX: number; clientY: number }) => void;
  onPointerLeave: () => void;
};

export const useGalaxyCamera = (): CameraRefs => {
  const l1 = useRef<HTMLDivElement>(null);
  const l2 = useRef<HTMLDivElement>(null);
  const l3 = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const applyCamera = (c: Camera) => {
      if (cam.current) cam.current.style.transform = `scale(${c.zoom})`;
    };

    const target: Camera = {
      cx: GALAXY_CENTER.x,
      cy: GALAXY_CENTER.y,
      zoom: 1,
    };
    if (reduce) {
      applyCamera(target);
      return;
    }

    let camCur: Camera = { ...target, zoom: 1.06 }; // settle 1.06 → 1.0 on load
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

      camCur = lerpCamera(camCur, target, 0.05);
      applyCamera(camCur);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    l1,
    l2,
    l3,
    cam,
    onPointerMove: (e) => {
      pointer.current = { x: e.clientX, y: e.clientY, active: true };
    },
    onPointerLeave: () => {
      pointer.current.active = false;
    },
  };
};
