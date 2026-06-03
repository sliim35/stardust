import { useEffect, useRef } from "react";
import { mulberry32 } from "#/lib/galaxy/rng";

/**
 * L1 — the farthest depth plane: a full-viewport seeded twinkling starfield with
 * a handful of sharp "blinkers" and the occasional shooting star. Pure ambience
 * behind the disk; it carries no data and never reacts to selection.
 *
 * Canvas-only and client-only: it draws in an effect (never during SSR), so the
 * seeded CSS starfield in `Layout` remains the server/no-JS placeholder until
 * hydration (ADR-0003). Honors `prefers-reduced-motion` by drawing one static
 * frame and stopping.
 */

const DEEP_SEED = 9999;
const STAR_COUNT = 200;
const BLINKER_COUNT = 35;

type Field = {
  x: number; // 0..1 of width
  y: number; // 0..1 of height
  size: 1 | 2;
  alpha: number;
  phase: number;
  speed: number;
  blinker: boolean;
};

const buildField = (): Field[] => {
  const rng = mulberry32(DEEP_SEED);
  const field: Field[] = [];
  for (let i = 0; i < STAR_COUNT + BLINKER_COUNT; i++) {
    const blinker = i >= STAR_COUNT;
    field.push({
      x: rng(),
      y: rng(),
      size: rng() < (blinker ? 0.5 : 0.12) ? 2 : 1,
      alpha: blinker ? 0.5 + rng() * 0.5 : 0.18 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
      speed: (blinker ? 1.6 : 0.5) + rng() * 1.2,
      blinker,
    });
  }
  return field;
};

export const DeepStarfield = () => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const field = buildField();
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      for (const s of field) {
        const tw = reduce
          ? 1
          : 0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.phase);
        ctx.globalAlpha = Math.max(0, s.alpha * tw);
        ctx.fillStyle = s.blinker ? "#eaf2ff" : "#cdd6ea";
        ctx.fillRect(Math.round(s.x * w), Math.round(s.y * h), s.size, s.size);
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Decorative; the wrapping `.galaxy-l1-wrap` is aria-hidden in the stage.
  return <canvas ref={ref} className="galaxy-l1" />;
};
