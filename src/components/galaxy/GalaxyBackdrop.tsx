import { useEffect, useRef } from "react";
import {
  type BackdropPoint,
  buildBackdropGeometry,
} from "#/lib/galaxy/backdrop";
import { type PaletteTokens, paletteFor } from "#/lib/galaxy/palette";
import { GALAXY_CENTER, GALAXY_R, STAGE_H, STAGE_W } from "#/lib/galaxy/place";
import { mulberry32 } from "#/lib/galaxy/rng";
import type { GalaxyBackdrop as Backdrop } from "#/lib/galaxy/types";

/**
 * L2 — the spiral disk (no central bar). **Soft-glow direction** (owner-chosen 2026-06-03,
 * `docs/superpowers/specs/2026-06-03-galaxy-soft-glow-direction-design.md`): the
 * seeded points render as soft additive glows (pre-rendered sprites + `lighter`
 * blending), so the arms read as smooth luminous bands rather than crisp
 * pixel-art grit. Geometry + density are unchanged; only the surface is soft.
 *
 * Two stacked canvases at the fixed 1280×800 internal resolution: a static
 * `base` (haze + arms + core + bar + bulge, drawn once per backdrop) and a
 * `live` overlay (RAF twinkle + a few thin shooting stars). Deterministic from
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

const drawBase = (
  ctx: CanvasRenderingContext2D,
  geom: ReturnType<typeof buildBackdropGeometry>,
  p: PaletteTokens,
  sprites: Sprites,
): void => {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);

  // Faint haze underlay — kept low so the arms read as soft light, not fog.
  const haze = (color: string, radius: number, alphaHex: string): void => {
    const g = ctx.createRadialGradient(
      GALAXY_CENTER.x,
      GALAXY_CENTER.y,
      0,
      GALAXY_CENTER.x,
      GALAXY_CENTER.y,
      radius,
    );
    g.addColorStop(0, color + alphaHex);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  };
  haze(p.hazeFar, GALAXY_R * 1.5, "16");
  haze(p.hazeNear, GALAXY_R * 0.85, "1e");

  paintGlow(ctx, geom.bgStars, sprites);
  paintGlow(ctx, geom.arms, sprites);

  // Compact, dim core glow drawn BEHIND the bright bar/bulge so the centre
  // reads as concentrated light, not a dominating bloom.
  const core = ctx.createRadialGradient(
    GALAXY_CENTER.x,
    GALAXY_CENTER.y,
    0,
    GALAXY_CENTER.x,
    GALAXY_CENTER.y,
    GALAXY_R * 0.2,
  );
  core.addColorStop(0, `${p.coreHot}99`);
  core.addColorStop(0.5, `${p.coreWarm}33`);
  core.addColorStop(1, `${p.coreWarm}00`);
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  paintGlow(ctx, geom.bulge, sprites);
};

type Shooter = {
  y0: number;
  slope: number;
  speed: number;
  len: number;
  period: number;
  offset: number;
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
    drawBase(bctx, geom, p, sprites);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    // Twinkle the brighter arm/bulge points; speed reuses the seeded phase.
    const twinklers = [...geom.arms, ...geom.bulge]
      .filter((s) => s.alpha > 0.5)
      .map((s) => ({ ...s, speed: 0.6 + s.phase * 1.6 }));

    const shooters: Shooter[] = Array.from({ length: 4 }, (_, i) => {
      const r = mulberry32(backdrop.seed ^ (0x51ed + i * 0x9e37));
      return {
        y0: r() * STAGE_H * 0.7,
        slope: -0.3 + r() * 0.2,
        speed: 220 + r() * 200,
        len: 60 + r() * 70,
        period: 4 + r() * 5,
        offset: r() * 6,
      };
    });

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

      for (const sh of shooters) {
        const prog = ((t + sh.offset) / sh.period) % 1;
        if (prog > 0.18) continue; // brief streak, long pause
        const head = -120 + prog * (STAGE_W + 240) * (sh.speed / 300);
        for (let k = 0; k < sh.len; k++) {
          lctx.globalAlpha = (1 - k / sh.len) * (1 - prog / 0.18) * 0.9;
          lctx.fillStyle = p.starHot;
          lctx.fillRect(
            Math.round(head - k),
            Math.round(sh.y0 + (head - k) * sh.slope),
            1,
            1,
          );
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
