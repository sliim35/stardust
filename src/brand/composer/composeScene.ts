/**
 * composeScene — the brand pixel-scene compositor (#83). Productionizes the
 * `pixelscene.html` prototype: paints L0–L5 into one native `NW×NH` canvas
 * (1 drawn pixel = 1 grid cell), nearest-neighbour upscales by an integer
 * `SCALE`, then paints the full-res type (L6) + scrim (L7) and crops to the exact
 * channel export size. Same `{channel, seed, copy}` ⇒ pixel-identical PNG.
 *
 * Layer order (spec §AC2): L0 void → L1 starfield → L2 galaxy (edge bleed) →
 * L3 planets → L4 hero star → L5 ASTRO (flippable) → upscale → L6 type → L7 scrim.
 *
 * The avatar channel is special-cased: per the owner-approved R3 decision it
 * reuses the ASTRO favicon tile (not a scene crop), so it ignores the seed.
 *
 * `@napi-rs/canvas` is a build/CLI-only native lib (devDependency). It is loaded
 * **lazily** at the top of each async render fn — never via a static
 * `import … from "@napi-rs/canvas"` — so the native lib stays out of every
 * statically-reachable module graph and can only enter on the CLI/compose path,
 * never a Worker route (#83 F2).
 */

import { faviconTilePath, spritePathFor } from "#/brand/composer/astro";
import { CHANNELS } from "#/brand/composer/channels";
import {
  BRAND_PALETTE,
  drawGalaxy,
  drawPlanet,
  drawSparkle,
  drawStarfield,
} from "#/brand/composer/renderers";
import { drawScrim, drawType } from "#/brand/composer/type-layer";
import type {
  ComposeSceneInput,
  ComposeSceneResult,
  SceneSidecar,
} from "#/brand/composer/types";

/** Derive the galaxy seed from the top-level seed (one number → whole frame). */
const SCENE_SALT = 0x9e3779b9 as const;

/** Render the fixed ASTRO favicon tile to the avatar export size (R3). */
const renderAvatar = async (size: number): Promise<Buffer> => {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = BRAND_PALETTE.void;
  ctx.fillRect(0, 0, size, size);
  const tile = await loadImage(faviconTilePath());
  ctx.drawImage(tile, 0, 0, size, size);
  return canvas.toBuffer("image/png");
};

export const composeScene = async (
  input: ComposeSceneInput,
): Promise<ComposeSceneResult> => {
  const {
    channel,
    seed,
    pose = "point",
    expression,
    faceLeft = true,
    heroStar = true,
    headline,
    emphasis,
    eyebrow,
    hudTag,
  } = input;
  const cfg = CHANNELS[channel];
  const { NW, NH, SCALE, exportW, exportH } = cfg;

  const sidecar: SceneSidecar = {
    seed,
    channel,
    NW,
    NH,
    SCALE,
    astroHeightPx: 16 * SCALE,
    pose,
    expression: expression ?? null,
    faceLeft,
    heroStar,
    headline: headline ?? null,
    emphasis: emphasis ?? null,
    eyebrow: eyebrow ?? null,
    hudTag: hudTag ?? null,
  };

  if (channel === "avatar") {
    return { png: await renderAvatar(exportW), sidecar };
  }

  const { createCanvas, loadImage } = await import("@napi-rs/canvas");

  // ── native low-res canvas: paint L0–L5 at 1 px per grid cell ──────────────
  const native = createCanvas(NW, NH);
  const c = native.getContext("2d");
  c.imageSmoothingEnabled = false;

  // L0 — void fill
  c.fillStyle = BRAND_PALETTE.void;
  c.fillRect(0, 0, NW, NH);

  // L1 — seeded two-tier starfield (sceneSeed)
  drawStarfield(c, NW, NH, seed ^ SCENE_SALT);

  // L2 — galaxy in its own square offscreen, composited with upper-right bleed
  const G = Math.round(1.45 * NH);
  const galaxy = createCanvas(G, G);
  const gctx = galaxy.getContext("2d");
  gctx.imageSmoothingEnabled = false;
  drawGalaxy(gctx, G, seed, BRAND_PALETTE);
  c.drawImage(
    galaxy,
    Math.round(0.75 * NW - G / 2),
    Math.round(0.51 * NH - G / 2),
  );

  // L3 — warm/cool framing planets
  drawPlanet(
    c,
    Math.round(0.13 * NW),
    Math.round(0.17 * NH),
    Math.max(5, Math.round(0.086 * NH)),
    "#3a5f8a",
    "#6f93c0",
    "#1d2f4a",
  );
  drawPlanet(
    c,
    Math.round(0.91 * NW),
    Math.round(0.876 * NH),
    Math.max(4, Math.round(0.057 * NH)),
    "#7a3326",
    "#b9624a",
    "#3d1813",
  );

  // L4 — optional gold hero/memory star (default ON), clear of the core
  if (heroStar) drawSparkle(c, Math.round(0.4 * NW), Math.round(0.34 * NH));

  // L5 — ASTRO sprite (16×16), left third, flipped to face inward
  const astro = await loadImage(spritePathFor({ pose, expression }));
  const ax = Math.round(0.13 * NW);
  const ay = Math.round(0.48 * NH);
  c.save();
  if (faceLeft) {
    c.translate(ax + 16, ay);
    c.scale(-1, 1);
    c.drawImage(astro, 0, 0, 16, 16);
  } else {
    c.drawImage(astro, ax, ay, 16, 16);
  }
  c.restore();

  // ── integer nearest-neighbour upscale onto the full-res stage ─────────────
  const upW = NW * SCALE;
  const upH = NH * SCALE;
  const stage = createCanvas(exportW, exportH);
  const m = stage.getContext("2d");
  m.imageSmoothingEnabled = false;
  // Upscale by the integer SCALE; the stage is the (possibly smaller) export
  // size, so any overshoot is a CROP of the integer-scaled image — never a stretch.
  m.drawImage(native, 0, 0, NW, NH, 0, 0, upW, upH);

  // L6 — full-res type (scale maps the 1200-wide proof coords to this export)
  await drawType(
    m,
    exportW,
    exportH,
    { headline, emphasis, eyebrow, hudTag },
    exportW / 1200,
  );

  // L7 — mandatory scrim (contrast floor)
  drawScrim(m, exportW, exportH);

  return { png: stage.toBuffer("image/png"), sidecar };
};
