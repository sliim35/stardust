import { useEffect, useRef } from "react";
import {
  LOADER_STARFIELD_SEED,
  type StarTier,
  starColorTier,
  starCountFor,
  TWINKLE_CYCLE_MS,
} from "#/lib/galaxy/loader";
import { paletteAccentRgb } from "#/lib/galaxy/palette";
import type { Palette } from "#/lib/galaxy/types";
import { generateStars, type Star } from "#/lib/starfield";

/**
 * The loader's full-viewport seeded twinkling starfield (AC1). Recreates the
 * handoff `<canvas id="stars">` backdrop: deterministic via `generateStars`
 * (`mulberry32` reused, never re-implemented) seeded `7777`, with the per-star
 * 3-tier color split from the pure `starColorTier`. Canvas-only + client-only — it
 * draws in an effect (never during SSR), so the loader's server markup is a black
 * placeholder until hydration (the DeepStarfield pattern, ADR-0003). Re-renders on
 * viewport resize. Honors `prefers-reduced-motion` by drawing one static frame.
 *
 * The accent-tier stars track the selected `palette` (passed from the loader), so
 * they ride the chosen sky like the chrome `--color-accent` does — the cool/dim
 * tiers stay neutral.
 */

/** The neutral (palette-independent) tiers — cool blue-grey + faint dust. */
const NEUTRAL_TIER_RGB = {
  cool: "176, 176, 192", // cool blue-grey
  dim: "122, 124, 134", // faint dust
} as const satisfies Record<Exclude<StarTier, "accent">, string>;

type Props = {
  /** The selected/persisted sky whose accent tints the accent-tier stars. */
  palette: Palette;
};

export const LoaderStarfield = ({ palette }: Props) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Tier → RGB triple: the accent tier rides the live sky; the rest are neutral.
    const tierRgb: Record<StarTier, string> = {
      accent: paletteAccentRgb(palette),
      ...NEUTRAL_TIER_RGB,
    };

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;
    // The prebuilt field for the current viewport — rebuilt only on resize, never
    // inside the rAF draw loop (the DeepStarfield build-once pattern).
    let stars: Star[] = [];

    // Build once per layout: size the canvas + regenerate the seeded field for the
    // current viewport area. The field depends only on that area + the fixed seed,
    // so a same-size rebuild is identical (deterministic, no flicker). Called on
    // mount and on every resize — NOT per frame.
    const build = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;
      stars = generateStars(
        LOADER_STARFIELD_SEED,
        starCountFor(w, h),
        Math.max(w, h),
      );
    };

    // Paint the prebuilt field: only reads canvas.width/height + `stars` (no
    // generateStars, no canvas resize) so it's cheap to run every rAF tick.
    const draw = (t: number) => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
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
        ctx.fillStyle = `rgba(${tierRgb[tier]}, ${(s.alpha * tw).toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    build();
    raf = requestAnimationFrame(draw);

    // Resize: rebuild the field for the new viewport, then under reduced motion
    // redraw the single static frame (the rAF loop picks up the new field/size on
    // its next tick when animating).
    const onResize = () => {
      build();
      if (reduce) draw(0);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [palette]);

  return <canvas ref={ref} className="astro-loader__stars fixed inset-0 z-0" />;
};
