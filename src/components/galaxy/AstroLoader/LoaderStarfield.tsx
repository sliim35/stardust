import { useEffect, useRef } from "react";
import {
  LOADER_STARFIELD_SEED,
  type StarTier,
  starColorTier,
  starCountFor,
  TWINKLE_CYCLE_MS,
} from "#/lib/galaxy/loader";
import { generateStars } from "#/lib/starfield";

/**
 * The loader's full-viewport seeded twinkling starfield (AC1). Recreates the
 * handoff `<canvas id="stars">` backdrop: deterministic via `generateStars`
 * (`mulberry32` reused, never re-implemented) seeded `7777`, with the per-star
 * 3-tier color split from the pure `starColorTier`. Canvas-only + client-only — it
 * draws in an effect (never during SSR), so the loader's server markup is a black
 * placeholder until hydration (the DeepStarfield pattern, ADR-0003). Re-renders on
 * viewport resize. Honors `prefers-reduced-motion` by drawing one static frame.
 */

/** Tier → RGB triple (loader token family); accent rides amber on the loader root. */
const TIER_RGB: Record<StarTier, string> = {
  accent: "245, 214, 160", // amber accent (matches the ember --color-accent)
  cool: "176, 176, 192", // cool blue-grey
  dim: "122, 124, 134", // faint dust
};

export const LoaderStarfield = () => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;

    // Seed once per layout: the field depends only on the viewport area + the fixed
    // seed, so it's identical on every resize draw (deterministic, no flicker).
    const draw = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;

      const stars = generateStars(
        LOADER_STARFIELD_SEED,
        starCountFor(w, h),
        Math.max(w, h),
      );
      for (const s of stars) {
        const tier = starColorTier(s);
        // Twinkle: a gentle per-star sine breathing keyed off the star's own alpha
        // phase, frozen to full brightness under reduced motion.
        const tw = reduce
          ? 1
          : 0.55 +
            0.45 *
              Math.abs(
                Math.sin(
                  (t / TWINKLE_CYCLE_MS) * Math.PI + s.alpha * Math.PI * 2,
                ),
              );
        ctx.fillStyle = `rgba(${TIER_RGB[tier]}, ${(s.alpha * tw).toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    // Re-render on resize: redraw a single static frame (or let the rAF loop pick up
    // the new size on its next tick when animating).
    const onResize = () => {
      if (reduce) draw(0);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="astro-loader__stars" />;
};
