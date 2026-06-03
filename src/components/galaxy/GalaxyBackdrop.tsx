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
 * L2 — the reworked barred-spiral disk (`docs/design/2026-06-02-explorable-galaxy.md`
 * §"GalaxyBackdrop rework"). Two stacked canvases at the fixed 1280×800 internal
 * resolution (the parent scales them, `image-rendering: pixelated` keeps them
 * crisp): a static `base` (haze + arms + bar + bulge + core, drawn once per
 * backdrop) and a `live` overlay (RAF twinkle + a few shooting stars).
 *
 * Deterministic from `backdrop.seed` — same seed, identical pixels (#4 AC1).
 * Client-only (draws in effects); reduced motion paints the base and stops.
 */

const tintOf = (warm: number, p: PaletteTokens): string =>
  warm > 0.7 ? p.starHot : warm > 0.4 ? p.starWarm : p.starCool;

const paintPoints = (
  ctx: CanvasRenderingContext2D,
  points: readonly BackdropPoint[],
  p: PaletteTokens,
): void => {
  for (const s of points) {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = tintOf(s.warm, p);
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
};

const drawBase = (
  ctx: CanvasRenderingContext2D,
  geom: ReturnType<typeof buildBackdropGeometry>,
  p: PaletteTokens,
): void => {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);

  // Two soft haze passes (reduced from the prototype's three so the arms read).
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
  // Faint haze underlay — kept low so the arms read as pixels, not glow (#50).
  haze(p.hazeFar, GALAXY_R * 1.5, "16");
  haze(p.hazeNear, GALAXY_R * 0.85, "1e");

  paintPoints(ctx, geom.bgStars, p);
  paintPoints(ctx, geom.arms, p);

  // Compact, dim core glow drawn BEHIND the bright bar/bulge pixels, so the
  // center reads as crisp blocky pixel-art rather than a dominating bloom (#50).
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

  paintPoints(ctx, geom.bar, p);
  paintPoints(ctx, geom.bulge, p);
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
    bctx.imageSmoothingEnabled = false;
    lctx.imageSmoothingEnabled = false;

    const p = paletteFor(backdrop.palette);
    const geom = buildBackdropGeometry(backdrop);
    drawBase(bctx, geom, p);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    // Twinkle the brighter arm/bulge points; speed reuses the seeded phase.
    const twinklers = [...geom.arms, ...geom.bulge, ...geom.bar]
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

    let raf = 0;
    const draw = (ms: number): void => {
      const t = ms * 0.001;
      lctx.clearRect(0, 0, STAGE_W, STAGE_H);
      lctx.globalCompositeOperation = "lighter";

      for (const s of twinklers) {
        const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase * 6.283);
        lctx.globalAlpha = s.alpha * tw * 0.7;
        lctx.fillStyle = p.starHot;
        lctx.fillRect(s.x, s.y, s.size, s.size);
      }

      for (const sh of shooters) {
        const prog = ((t + sh.offset) / sh.period) % 1;
        if (prog > 0.18) continue; // brief streak, long pause
        const head = -120 + prog * (STAGE_W + 240) * (sh.speed / 300);
        const hx = head;
        const hy = sh.y0 + head * sh.slope;
        for (let k = 0; k < sh.len; k++) {
          lctx.globalAlpha = (1 - k / sh.len) * (1 - prog / 0.18) * 0.9;
          lctx.fillStyle = p.starHot;
          lctx.fillRect(
            Math.round(hx - k),
            Math.round(hy - k * sh.slope),
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
