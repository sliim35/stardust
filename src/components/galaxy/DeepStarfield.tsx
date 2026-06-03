import { useEffect, useRef } from "react";
import {
  buildDeepMeteors,
  meteorHeadX,
  STREAK_WINDOW,
} from "#/lib/galaxy/meteors";
import { mulberry32 } from "#/lib/galaxy/rng";
import { kindFor, twinkleAlpha } from "#/lib/galaxy/twinkle";

/**
 * L1 — the farthest depth plane: a full-viewport seeded twinkling starfield with
 * a handful of sharp "blinkers" and the occasional shooting star. Pure ambience
 * behind the disk; it carries no data and never reacts to selection.
 *
 * Canvas-only and client-only: it draws in an effect (never during SSR), so the
 * seeded CSS starfield in `Layout` remains the server/no-JS placeholder until
 * hydration (ADR-0003). Honors `prefers-reduced-motion` by drawing one static
 * frame and stopping.
 *
 * Twinkle curves live in the pure `twinkle` module (#56): a seeded **dim subset**
 * of the faint stars truly blinks 0 → 1 (rectified pow sine), the bright blinkers
 * keep their crisp legacy shimmer, and the rest gently breathe — phase-staggered
 * so only a few are ever dark at once (no whole-field strobe).
 */

const DEEP_SEED = 9999;
const STAR_COUNT = 200;
const BLINKER_COUNT = 35;
/** Fraction of the faint (non-blinker) stars that truly blink out to 0. */
const DIM_BLINK_RATE = 0.3;

type Field = {
  x: number; // 0..1 of width
  y: number; // 0..1 of height
  size: 1 | 2;
  alpha: number;
  phase: number;
  speed: number;
  blinker: boolean;
  blink: boolean; // a faint star in the true-0 blink subset (#56)
};

const buildField = (): Field[] => {
  const rng = mulberry32(DEEP_SEED);
  const field: Field[] = [];
  for (let i = 0; i < STAR_COUNT + BLINKER_COUNT; i++) {
    const blinker = i >= STAR_COUNT;
    const blink = !blinker && rng() < DIM_BLINK_RATE;
    field.push({
      x: rng(),
      y: rng(),
      size: rng() < (blinker ? 0.5 : 0.12) ? 2 : 1,
      alpha: blinker ? 0.5 + rng() * 0.5 : 0.18 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
      // Blink stars are deliberately slow (a multi-second appear/disappear so the
      // long true-0 trough never reads as a flicker); blinkers stay fast + crisp.
      speed: (blinker ? 1.6 : blink ? 0.22 : 0.5) + rng() * (blink ? 0.3 : 1.2),
      blinker,
      blink,
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
    // L1 parallax depth (#55): 2–3 fainter, slower far-meteors. Geometry is the
    // pure, unit-tested `meteors` module; normalized y0/coords scale to the
    // viewport here. Skipped entirely under reduced motion (no streaks).
    const meteors = buildDeepMeteors(DEEP_SEED);
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
          : twinkleAlpha(
              t * 0.001 * s.speed + s.phase,
              kindFor(s.blinker, s.blink),
            );
        ctx.globalAlpha = Math.max(0, s.alpha * tw);
        ctx.fillStyle = s.blinker ? "#eaf2ff" : "#cdd6ea";
        ctx.fillRect(Math.round(s.x * w), Math.round(s.y * h), s.size, s.size);
      }

      // Faint, slow far-meteors for depth — never under reduced motion.
      if (!reduce) {
        const sec = t * 0.001;
        for (const m of meteors) {
          const prog = ((sec + m.offset) / m.period) % 1;
          if (prog > STREAK_WINDOW) continue; // brief streak, long pause
          const head = meteorHeadX(m, prog / STREAK_WINDOW, w);
          const y0 = m.y0 * h;
          const fade = 1 - prog / STREAK_WINDOW;
          for (let k = 0; k < m.len; k++) {
            const x = head - m.dir * k;
            ctx.globalAlpha = (1 - k / m.len) * fade * m.alpha;
            ctx.fillStyle = "#dfe7f5";
            // Slope is HEAD-relative here ((x - head) → tail pivots on the head),
            // whereas L2's `GalaxyBackdrop` applies it STAGE-absolute (x * slope).
            // Deliberate: different coordinate spaces — don't "align" the two or
            // the meteors' angle/anchoring shifts. (story #55)
            ctx.fillRect(
              Math.round(x),
              Math.round(y0 + (x - head) * m.slope),
              1,
              1,
            );
          }
        }
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
