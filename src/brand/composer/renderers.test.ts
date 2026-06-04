import { describe, expect, it } from "vitest";
import type { PixelCtx } from "#/brand/composer/renderers";
import {
  BRAND_PALETTE,
  drawGalaxy,
  drawPlanet,
  drawSparkle,
  drawStarfield,
} from "#/brand/composer/renderers";

// A recording fake of the tiny 2D-context subset the renderers use. Lets us test
// the *behaviour* (determinism, geometry, palette) without the canvas lib.
type Op = { x: number; y: number; col: string; a: number };
const recorder = () => {
  const ops: Op[] = [];
  let fillStyle = "#000";
  let globalAlpha = 1;
  const ctx = {
    imageSmoothingEnabled: true,
    set fillStyle(v: string) {
      fillStyle = v;
    },
    get fillStyle() {
      return fillStyle;
    },
    set globalAlpha(v: number) {
      globalAlpha = v;
    },
    get globalAlpha() {
      return globalAlpha;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      // renderers only ever plot 1×1 cells
      expect(w).toBe(1);
      expect(h).toBe(1);
      ops.push({ x, y, col: fillStyle, a: globalAlpha });
    },
  } as unknown as PixelCtx & { imageSmoothingEnabled: boolean };
  return { ctx, ops };
};

describe("drawPlanet", () => {
  it("paints a filled disc within the radius, nothing outside", () => {
    const { ctx, ops } = recorder();
    const r = 6;
    drawPlanet(ctx, 20, 20, r, "#3a5f8a", "#6f93c0", "#1d2f4a");
    expect(ops.length).toBeGreaterThan(0);
    for (const o of ops) {
      const dx = o.x - 20;
      const dy = o.y - 20;
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(r * r);
    }
  });

  it("uses light on the lit side, dark on the edge, base in the body", () => {
    const { ctx, ops } = recorder();
    drawPlanet(ctx, 20, 20, 6, "#3a5f8a", "#6f93c0", "#1d2f4a");
    const cols = new Set(ops.map((o) => o.col));
    expect(cols.has("#3a5f8a")).toBe(true); // base
    expect(cols.has("#6f93c0")).toBe(true); // light
    expect(cols.has("#1d2f4a")).toBe(true); // dark edge
  });

  it("is deterministic (no RNG — pure geometry)", () => {
    const a = recorder();
    const b = recorder();
    drawPlanet(a.ctx, 10, 10, 5, "#111111", "#222222", "#000000");
    drawPlanet(b.ctx, 10, 10, 5, "#111111", "#222222", "#000000");
    expect(a.ops).toEqual(b.ops);
  });
});

describe("drawStarfield", () => {
  it("is deterministic for a given seed", () => {
    const a = recorder();
    const b = recorder();
    drawStarfield(a.ctx, 200, 105, 424242);
    drawStarfield(b.ctx, 200, 105, 424242);
    expect(a.ops).toEqual(b.ops);
  });

  it("diverges for a different seed", () => {
    const a = recorder();
    const b = recorder();
    drawStarfield(a.ctx, 200, 105, 1);
    drawStarfield(b.ctx, 200, 105, 2);
    expect(a.ops).not.toEqual(b.ops);
  });

  it("scales the dim tier with native area and adds bright sparkles", () => {
    const small = recorder();
    const big = recorder();
    drawStarfield(small.ctx, 100, 50, 7);
    drawStarfield(big.ctx, 200, 100, 7);
    expect(big.ops.length).toBeGreaterThan(small.ops.length);
  });

  it("keeps every plotted cell inside the native canvas", () => {
    const { ctx, ops } = recorder();
    drawStarfield(ctx, 200, 105, 99);
    for (const o of ops) {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.x).toBeLessThan(200);
      expect(o.y).toBeGreaterThanOrEqual(0);
      expect(o.y).toBeLessThan(105);
    }
  });
});

describe("drawGalaxy", () => {
  it("is deterministic for a given seed", () => {
    const a = recorder();
    const b = recorder();
    drawGalaxy(a.ctx, 152, 7777, BRAND_PALETTE);
    drawGalaxy(b.ctx, 152, 7777, BRAND_PALETTE);
    expect(a.ops).toEqual(b.ops);
  });

  it("diverges for a different seed", () => {
    const a = recorder();
    const b = recorder();
    drawGalaxy(a.ctx, 152, 7777, BRAND_PALETTE);
    drawGalaxy(b.ctx, 152, 1234, BRAND_PALETTE);
    expect(a.ops).not.toEqual(b.ops);
  });

  it("disables image smoothing on the offscreen it draws into", () => {
    const { ctx } = recorder();
    drawGalaxy(ctx, 64, 7777, BRAND_PALETTE);
    expect(
      (ctx as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled,
    ).toBe(false);
  });

  it("reserves gold for the core — the warm hero hue appears near the centre", () => {
    const { ctx, ops } = recorder();
    const G = 152;
    drawGalaxy(ctx, G, 7777, BRAND_PALETTE);
    const gold = ops.filter((o) => o.col === BRAND_PALETTE.coreWarm);
    expect(gold.length).toBeGreaterThan(0);
    // gold's centroid sits near the galaxy centre, not scattered to the rim
    const cx = gold.reduce((s, o) => s + o.x, 0) / gold.length;
    const cy = gold.reduce((s, o) => s + o.y, 0) / gold.length;
    expect(Math.abs(cx - G / 2)).toBeLessThan(G * 0.25);
    expect(Math.abs(cy - G / 2)).toBeLessThan(G * 0.25);
  });
});

describe("drawSparkle", () => {
  it("plots a crisp gold 4-point star centred on (cx,cy)", () => {
    const { ctx, ops } = recorder();
    drawSparkle(ctx, 50, 40);
    const center = ops.find((o) => o.x === 50 && o.y === 40);
    expect(center).toBeDefined();
    // arms exist on all four sides
    expect(ops.some((o) => o.x === 51 && o.y === 40)).toBe(true);
    expect(ops.some((o) => o.x === 49 && o.y === 40)).toBe(true);
    expect(ops.some((o) => o.x === 50 && o.y === 41)).toBe(true);
    expect(ops.some((o) => o.x === 50 && o.y === 39)).toBe(true);
  });
});
