/**
 * Pixel renderers for the brand composer, **recreated** from the documented
 * behaviour (the design spec + `pixelscene.html`), NOT copied verbatim from the
 * prototype `stardust/project/galaxy.jsx` (ADR-0002 §2). Each is a pure painter
 * over a tiny 2D-context subset (`PixelCtx`) so it composites onto the native
 * `NW×NH` canvas at 1 drawn pixel = 1 grid cell, and stays unit-testable with a
 * recording fake.
 *
 * The galaxy is a 4-arm **barred spiral**: a tilted gold core bar, blue spiral
 * arms with hot/warm/cool star scatter and sparse pink nebula knots, plus a
 * layered blue haze. Gold is reserved for the core (#83 do/don't). The starfield
 * is two tiers: a dense dim cool scatter for depth + a few bright 4-point
 * sparkles. All seeded via the shared `mulberry32`, so the same seed reproduces
 * the scene forever (#83 AC3).
 */

import { mulberry32 } from "#/lib/galaxy/rng";

/**
 * The minimal 2D-context surface the renderers touch (canvas-lib agnostic).
 * `fillStyle` is widened to the canvas union so a real `SKRSContext2D` is
 * assignable; the renderers themselves only ever assign solid-color strings.
 */
export type PixelCtx = {
  imageSmoothingEnabled: boolean;
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  fillRect: (x: number, y: number, w: number, h: number) => void;
};

/** Brand palette — the galaxy token set in chunky-pixel mode (spec §AC1). */
export const BRAND_PALETTE = {
  void: "#04050d",
  coreHot: "#fffaf0",
  coreWarm: "#f5d6a0", // HERO GOLD — reserved for the core + memory star
  starHot: "#fffdf6",
  starWarm: "#f5d6a0",
  starCool: "#9cd8c0",
  diskBlue: "#5a6ea0",
  diskBlueLight: "#7888c0",
  armBlue: "#6a7aba",
  outerBlue: "#8898d0",
  armStar: "#8898cc",
  nebulaPink: "#e8a9b0",
} as const;

export type BrandPalette = typeof BRAND_PALETTE;

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
};

const rgba = (c: [number, number, number], a: number): string =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const plot = (
  ctx: PixelCtx,
  x: number,
  y: number,
  col: string,
  alpha: number,
): void => {
  ctx.fillStyle = col;
  ctx.globalAlpha = alpha;
  ctx.fillRect(x | 0, y | 0, 1, 1);
};

/**
 * A 4-arm barred-spiral galaxy painted into a square `G×G` offscreen, tilted and
 * seeded. Gold bar/core, blue arms with hot/warm/cool scatter + pink nebula
 * knots, then layered blue haze. Recreated per ADR-0002 §2.
 */
export const drawGalaxy = (
  ctx: PixelCtx,
  G: number,
  seed: number,
  pal: BrandPalette,
): void => {
  ctx.imageSmoothingEnabled = false;
  const cx = G / 2;
  const cy = G / 2;
  const rng = mulberry32(seed);
  const maxR = G * 0.47;
  const tilt = 0.72;
  const barAngle = (25 * Math.PI) / 180;
  const barLen = maxR * 0.32;
  const barWidth = maxR * 0.1;

  const diskBlue = hexToRgb(pal.diskBlue);
  const diskBlueLight = hexToRgb(pal.diskBlueLight);
  const armBlue = hexToRgb(pal.armBlue);
  const outerBlue = hexToRgb(pal.outerBlue);
  const voidRgb = hexToRgb(pal.void);

  // 1) central bar (gold) — an ellipse rotated by barAngle, squashed by tilt
  for (let i = 0; i < 800; i++) {
    const bx = (rng() - 0.5) * 2 * barLen;
    const by = (rng() - 0.5) * 2 * barWidth;
    const d = (bx / barLen) ** 2 + (by / barWidth) ** 2;
    if (d > 1) continue;
    const rx = bx * Math.cos(barAngle) - by * Math.sin(barAngle);
    const ry = (bx * Math.sin(barAngle) + by * Math.cos(barAngle)) * tilt;
    plot(
      ctx,
      cx + rx,
      cy + ry,
      rng() > 0.4 ? pal.coreHot : pal.coreWarm,
      0.6 + (1 - d) * 0.35,
    );
  }

  // 2) four logarithmic spiral arms (two primary, two secondary)
  for (let arm = 0; arm < 4; arm++) {
    const isPrimary = arm < 2;
    const baseA = (arm * Math.PI) / 2 + barAngle;
    const startR = isPrimary ? barLen * 0.7 : barLen * 0.4;
    const count = isPrimary ? 1100 : 715;
    const armSpread = isPrimary ? 0.45 : 0.35;
    for (let i = 0; i < count; i++) {
      const t = rng();
      const r = startR + t ** 0.5 * (maxR - startR);
      const theta = baseA + Math.log(r / startR + 0.01) * 1.8;
      const spread = armSpread * (8 + r * 0.15);
      const j = (rng() - 0.5) * spread;
      const px =
        cx + Math.cos(theta) * r + Math.cos(theta + Math.PI / 2) * j * 0.35;
      const py =
        cy +
        (Math.sin(theta) * r + Math.sin(theta + Math.PI / 2) * j * 0.35) * tilt;
      if (px < 0 || px >= G || py < 0 || py >= G) continue;
      const v = rng();
      const distFrac = (r - startR) / (maxR - startR);
      let col: string;
      if (r < barLen) col = pal.coreWarm;
      else if (distFrac < 0.3) col = v > 0.8 ? pal.starHot : pal.coreWarm;
      else col = v > 0.88 ? pal.starHot : v > 0.5 ? pal.starWarm : pal.armStar;
      const alpha = isPrimary
        ? distFrac < 0.2
          ? 0.85
          : 0.35 + rng() * 0.5
        : 0.25 + rng() * 0.4;
      plot(ctx, px, py, col, alpha);
      // sparse pink nebula knots in the outer arms
      if (distFrac > 0.25 && rng() > 0.985) {
        for (let n = 0; n < 3; n++) {
          plot(
            ctx,
            px + (rng() - 0.5) * 3,
            py + (rng() - 0.5) * 3,
            pal.nebulaPink,
            0.2 + rng() * 0.15,
          );
        }
      }
    }
  }

  // 3) inter-arm void scatter (deepens the gaps between arms)
  for (let i = 0; i < 600; i++) {
    const a = rng() * Math.PI * 2;
    const r = 20 + rng() ** 0.6 * (maxR * 0.85);
    plot(
      ctx,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r * tilt,
      rgba(voidRgb, 1),
      0.15 + rng() * 0.15,
    );
  }

  // 4) bright core bulge + hot nucleus
  for (let i = 0; i < 600; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() ** 2 * maxR * 0.18;
    plot(
      ctx,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r * 0.8,
      rng() > 0.5 ? pal.coreHot : pal.coreWarm,
      0.75 + rng() * 0.25,
    );
  }
  for (let i = 0; i < 120; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() ** 2.5 * 8;
    plot(
      ctx,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r * 0.75,
      pal.coreHot,
      0.9,
    );
  }

  // 5) layered blue haze (disk glow) — three passes for depth
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < 3000; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() ** 0.4 * maxR;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * tilt;
      const df = r / maxR;
      const col =
        df > 0.5
          ? rgba(outerBlue, 1)
          : df > 0.2
            ? rgba(diskBlueLight, 1)
            : rgba(diskBlue, 1);
      plot(ctx, px, py, col, 0.06 + rng() * 0.1);
    }
  }
  for (let i = 0; i < 4000; i++) {
    const a = rng() * Math.PI * 2;
    const r = maxR * 0.1 + rng() ** 0.45 * maxR * 0.85;
    plot(
      ctx,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r * tilt,
      rgba(armBlue, 1),
      0.05 + rng() * 0.08,
    );
  }
  for (let i = 0; i < 1200; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() ** 0.6 * maxR * 0.3;
    plot(
      ctx,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r * tilt,
      rgba(diskBlue, 1),
      0.04 + rng() * 0.06,
    );
  }

  ctx.globalAlpha = 1;
};

/**
 * A small pixel planet — a flat-shaded disc with a lit upper-left highlight and a
 * 1-px dark rim. Pure geometry (no RNG), so it is deterministic by construction.
 */
export const drawPlanet = (
  ctx: PixelCtx,
  cx: number,
  cy: number,
  r: number,
  base: string,
  light: string,
  dark: string,
): void => {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const lit = x + y < -r * 0.4;
      const edge = x * x + y * y > (r - 1) * (r - 1);
      plot(ctx, cx + x, cy + y, edge ? dark : lit ? light : base, 1);
    }
  }
  ctx.globalAlpha = 1;
};

const STARFIELD_COLS = [
  "#b0c2bc",
  "#9cd8c0",
  "#e7f0ec",
  "#cfe0da",
  "#fffdf6",
] as const;
/**
 * Dim-tier star count as a fraction of native cells (~2.7%). Encodes spec §AC1
 * (composition rule 4: "~560 stars" on the 200×105 proof grid → 560/21000 ≈ 0.027).
 */
const STARFIELD_DENSITY = 0.027;
/**
 * Bright 4-point foreground sparkles. Encodes spec §AC1 (composition rule 4:
 * "~14 brighter foreground sparkles drawn as a 4-point plus").
 */
const SPARKLE_COUNT = 14;

/**
 * Seeded two-tier starfield: a dense dim cool scatter (depth) + a few bright
 * 4-point sparkles (`#fffdf6` core, dimmer arms). Density scales with native
 * area; every cell stays inside `NW×NH`.
 */
export const drawStarfield = (
  ctx: PixelCtx,
  NW: number,
  NH: number,
  seed: number,
): void => {
  const rng = mulberry32(seed);
  const nStars = Math.round(NW * NH * STARFIELD_DENSITY);
  for (let i = 0; i < nStars; i++) {
    const x = (rng() * NW) | 0;
    const y = (rng() * NH) | 0;
    plot(
      ctx,
      x,
      y,
      STARFIELD_COLS[(rng() * STARFIELD_COLS.length) | 0],
      0.15 + rng() * 0.62,
    );
  }
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const x = (10 + rng() * (NW - 20)) | 0;
    const y = (6 + rng() * (NH - 12)) | 0;
    plot(ctx, x, y, "#fffdf6", 0.9);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      plot(ctx, x + dx, y + dy, "#fffdf6", 0.45);
    }
  }
  ctx.globalAlpha = 1;
};

/**
 * The optional gold hero/memory star (L4) — a crisp 4-point pixel star with a
 * soft bloom, in HERO GOLD. The single focal "memory" anchor (default ON).
 */
export const drawSparkle = (ctx: PixelCtx, cx: number, cy: number): void => {
  for (let y = -4; y <= 4; y++) {
    for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, y);
      if (d <= 4)
        plot(ctx, cx + x, cy + y, "#f5d6a0", Math.max(0, 0.18 * (1 - d / 4)));
    }
  }
  plot(ctx, cx, cy, "#fffefa", 1);
  for (const d of [1, 2, 3]) {
    const a = d === 1 ? 0.95 : d === 2 ? 0.7 : 0.4;
    plot(ctx, cx + d, cy, "#f5d6a0", a);
    plot(ctx, cx - d, cy, "#f5d6a0", a);
    plot(ctx, cx, cy + d, "#f5d6a0", a);
    plot(ctx, cx, cy - d, "#f5d6a0", a);
  }
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    plot(ctx, cx + dx, cy + dy, "#ffe6a6", 1);
  }
  ctx.globalAlpha = 1;
};
