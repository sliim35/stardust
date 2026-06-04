import { useEffect, useRef } from "react";
import {
  type BackdropPoint,
  buildBackdropGeometry,
} from "#/lib/galaxy/backdrop";
import {
  buildShooters,
  SHOOTER_ALPHA_CAP,
  stepMeteor,
} from "#/lib/galaxy/meteors";
import { paletteFor } from "#/lib/galaxy/palette";
import { STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import type { GalaxyBackdrop as Backdrop } from "#/lib/galaxy/types";

/**
 * L2 — the spiral disk (no central bar). **Soft-glow direction** (owner-chosen 2026-06-03,
 * `docs/superpowers/specs/2026-06-03-galaxy-soft-glow-direction-design.md`): the
 * seeded points render as soft additive glows (pre-rendered sprites + `lighter`
 * blending), so the arms read as smooth luminous bands rather than crisp
 * pixel-art grit. Geometry + density are unchanged; only the surface is soft.
 *
 * Two stacked canvases at the fixed 1280×800 internal resolution, both
 * transparent-backed: a static `base` (the disk-glow point clouds — bgStars +
 * arms + bulge — drawn once per backdrop) and a `live` overlay (RAF twinkle + a
 * few thin shooting stars). The nebula haze + core washes moved out to the
 * full-bleed `BackdropTint` (Layer A, #76), so this canvas paints only additive
 * glow and the tint shows through with no rectangular seam. Deterministic from
 * `backdrop.seed`. Client-only (draws in effects); reduced motion paints the
 * base and stops.
 */

const SPRITE_PX = 16; // offscreen glow-sprite resolution
type Sprites = readonly [
  HTMLCanvasElement,
  HTMLCanvasElement,
  HTMLCanvasElement,
];

/** cool / warm / hot bucket for a point's warmth (matches the palette star tones). */
const bucketOf = (warm: number): 0 | 1 | 2 =>
  warm > 0.7 ? 2 : warm > 0.4 ? 1 : 0;

/** A soft round glow (color centre → transparent), pre-rendered once per palette. */
const makeGlowSprite = (color: string): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = SPRITE_PX;
  c.height = SPRITE_PX;
  const cx = c.getContext("2d");
  if (cx) {
    const r = SPRITE_PX / 2;
    const g = cx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, color);
    g.addColorStop(0.35, `${color}80`);
    g.addColorStop(1, `${color}00`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
  }
  return c;
};

/** Paint a point cloud as soft additive glows — no hard pixels (#50 → soft direction). */
const paintGlow = (
  ctx: CanvasRenderingContext2D,
  points: readonly BackdropPoint[],
  sprites: Sprites,
): void => {
  ctx.globalCompositeOperation = "lighter";
  for (const s of points) {
    const d = s.size === 2 ? 5.6 : 3.6;
    ctx.globalAlpha = s.alpha;
    ctx.drawImage(sprites[bucketOf(s.warm)], s.x - d / 2, s.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};

/**
 * The disk glow only (#76): a transparent canvas of additive point-sprite
 * clouds — `bgStars` → `arms` → `bulge`. The nebula haze + core full-rect washes
 * that used to fill this 1280×800 canvas (their rectangular edge was the seam)
 * now live full-bleed in `BackdropTint` (Layer A); this canvas starts cleared so
 * the tint shows through everywhere — no background fill, no rectangle, no seam.
 * The browser composites this transparent-backed canvas over that tint, so the
 * additive `lighter` light lands over the nebula exactly as before.
 */
const drawBase = (
  ctx: CanvasRenderingContext2D,
  geom: ReturnType<typeof buildBackdropGeometry>,
  sprites: Sprites,
): void => {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  paintGlow(ctx, geom.bgStars, sprites);
  paintGlow(ctx, geom.arms, sprites);
  paintGlow(ctx, geom.bulge, sprites);
};

export const GalaxyBackdrop = ({ backdrop }: { backdrop: Backdrop }) => {
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const base = baseRef.current;
    const live = liveRef.current;
    if (!base || !live) return;
    const bctx = base.getContext("2d");
    const lctx = live.getContext("2d");
    if (!bctx || !lctx) return;

    for (const c of [base, live]) {
      c.width = STAGE_W;
      c.height = STAGE_H;
    }
    bctx.imageSmoothingEnabled = true;
    lctx.imageSmoothingEnabled = true;

    const p = paletteFor(backdrop.palette);
    const sprites: Sprites = [
      makeGlowSprite(p.starCool),
      makeGlowSprite(p.starWarm),
      makeGlowSprite(p.starHot),
    ];
    const geom = buildBackdropGeometry(backdrop);
    drawBase(bctx, geom, sprites);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    // Twinkle the brighter arm/bulge points; speed reuses the seeded phase.
    const twinklers = [...geom.arms, ...geom.bulge]
      .filter((s) => s.alpha > 0.5)
      .map((s) => ({ ...s, speed: 0.6 + s.phase * 1.6 }));

    // Multi-directional, full-field streaks (story #55, spike #54): origin edge,
    // slope sign, and y0 all varied per shooter; geometry lives in the pure,
    // unit-tested `meteors` module so this loop only draws.
    const shooters = buildShooters(backdrop.seed);

    const hot = sprites[2];
    let raf = 0;
    const draw = (ms: number): void => {
      const t = ms * 0.001;
      lctx.clearRect(0, 0, STAGE_W, STAGE_H);
      lctx.globalCompositeOperation = "lighter";

      for (const s of twinklers) {
        const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase * 6.283);
        const d = s.size === 2 ? 6.5 : 4.5;
        lctx.globalAlpha = s.alpha * tw * 0.6;
        lctx.drawImage(hot, s.x - d / 2, s.y - d / 2, d, d);
      }

      // The streak stepping (window gate, head, fade, per-pixel taper, slope) is the
      // pure `stepMeteor`; this loop only fills the pixels it returns. STAGE-absolute
      // frame + y0 as-is + the SHOOTER_ALPHA_CAP peak (L1 is HEAD-relative + dimmer) —
      // the asymmetry lives in `StepOpts`, not here (#55).
      lctx.fillStyle = p.starHot;
      for (const sh of shooters) {
        for (const px of stepMeteor(sh, t, {
          width: STAGE_W,
          y0Scale: 1,
          slopeFrame: "absolute",
          alphaCap: SHOOTER_ALPHA_CAP,
        })) {
          lctx.globalAlpha = px.alpha;
          lctx.fillRect(px.x, px.y, 1, 1);
        }
      }

      lctx.globalAlpha = 1;
      lctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [backdrop]);

  return (
    <div className="galaxy-l2" aria-hidden="true">
      <canvas ref={baseRef} className="galaxy-l2__canvas" />
      <canvas ref={liveRef} className="galaxy-l2__canvas" />
    </div>
  );
};
