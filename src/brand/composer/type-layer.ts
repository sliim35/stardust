/**
 * L6 (type) + L7 (scrim) — the full-resolution layers painted *after* the
 * integer nearest-neighbour upscale (crisp serif/mono over chunky pixels is the
 * intended look; type is never pixelated). The scrim is mandatory so type
 * contrast is structural (#83 AC10).
 *
 * Fonts: brand intent is Newsreader (serif italic) + JetBrains Mono. No brand
 * TTF/OTF ships in-repo, so we register any present under `assets/fonts/` and
 * otherwise fall back to `@napi-rs/canvas`'s **bundled** `PT Serif` / `PT Mono`
 * (embedded in the lib, not OS fonts) — a deterministic, dependency-free
 * approximation that keeps renders byte-identical across machines (#83 AC3).
 * Committing the real brand fonts would make the type pixel-match the proof.
 */

import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
// `@napi-rs/canvas` is a build/CLI-only native lib (devDependency). It is
// **type-only** here (erased at compile time) and **lazily** loaded inside
// `ensureFonts`, so this module never pins the native lib into a Worker runtime
// graph — only the actual draw call (on the CLI/compose path) pulls it in (#83 F2).
import type {
  GlobalFonts as GlobalFontsType,
  SKRSContext2D,
} from "@napi-rs/canvas";
import { TYPE_COLORS } from "#/brand/composer/contrast";

const FONT_DIR = fileURLToPath(new URL("../assets/fonts/", import.meta.url));

let registeredFonts: typeof GlobalFontsType | null = null;
/**
 * Register any brand fonts shipped under assets/fonts/ (idempotent) and return
 * the `GlobalFonts` handle. The canvas lib is loaded lazily here so it stays out
 * of any statically-reachable module graph (#83 F2).
 */
const ensureFonts = async (): Promise<typeof GlobalFontsType> => {
  if (registeredFonts) return registeredFonts;
  const { GlobalFonts } = await import("@napi-rs/canvas");
  registeredFonts = GlobalFonts;
  if (existsSync(FONT_DIR)) {
    for (const f of readdirSync(FONT_DIR)) {
      if (/\.(ttf|otf)$/i.test(f))
        GlobalFonts.registerFromPath(`${FONT_DIR}${f}`);
    }
  }
  return GlobalFonts;
};

const has = (fonts: typeof GlobalFontsType, family: string): boolean =>
  fonts.families.some((f) => f.family === family);

/** Serif family for the headline — brand Newsreader, else bundled PT Serif. */
const serifFamily = (fonts: typeof GlobalFontsType): string =>
  has(fonts, "Newsreader") ? "Newsreader" : "PT Serif";
/** Mono family for eyebrow/HUD — brand JetBrains Mono, else bundled PT Mono. */
const monoFamily = (fonts: typeof GlobalFontsType): string =>
  has(fonts, "JetBrains Mono") ? "JetBrains Mono" : "PT Mono";

/** Draw a string with manual letter-spacing (canvas has no native tracking). */
const drawTracked = (
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
): void => {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
};

export type TypeCopy = {
  headline?: string;
  emphasis?: string;
  eyebrow?: string;
  hudTag?: string;
};

/**
 * Paint L6 (type) at full resolution. `scale` maps the proof's 1200×630
 * stage-coordinates to the channel's export size so layout is consistent across
 * channels.
 */
export const drawType = async (
  ctx: SKRSContext2D,
  W: number,
  H: number,
  copy: TypeCopy,
  scale: number,
): Promise<void> => {
  const fonts = await ensureFonts();
  const left = 72 * scale;
  const bottom = 78 * scale;
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 26 * scale;
  ctx.shadowOffsetY = 2 * scale;

  // headline (Newsreader italic) — last baseline sits `bottom` from the floor
  if (copy.headline) {
    const fontPx = 50 * scale;
    const lineH = fontPx * 1.1;
    ctx.font = `italic 400 ${fontPx}px "${serifFamily(fonts)}", serif`;
    const lines = copy.headline.split("\n");
    const firstBaseline = H - bottom - (lines.length - 1) * lineH;
    lines.forEach((line, i) => {
      const y = firstBaseline + i * lineH;
      if (copy.emphasis && line.includes(copy.emphasis)) {
        const [pre, post] = line.split(copy.emphasis);
        let cx = left;
        ctx.fillStyle = TYPE_COLORS.headline;
        ctx.fillText(pre, cx, y);
        cx += ctx.measureText(pre).width;
        ctx.fillStyle = TYPE_COLORS.emphasis;
        ctx.fillText(copy.emphasis, cx, y);
        cx += ctx.measureText(copy.emphasis).width;
        ctx.fillStyle = TYPE_COLORS.headline;
        ctx.fillText(post, cx, y);
      } else {
        ctx.fillStyle = TYPE_COLORS.headline;
        ctx.fillText(line, left, y);
      }
    });

    // eyebrow (JetBrains Mono uppercase, tracked) — above the headline block
    if (copy.eyebrow) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.font = `700 ${15 * scale}px "${monoFamily(fonts)}", monospace`;
      ctx.fillStyle = TYPE_COLORS.eyebrow;
      const eyebrowY = firstBaseline - lineH - 18 * scale;
      drawTracked(
        ctx,
        copy.eyebrow.toUpperCase(),
        left,
        eyebrowY,
        0.42 * 15 * scale,
      );
    }
  }

  // HUD tag (faint mono, tracked) — bottom-right
  if (copy.hudTag) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.font = `500 ${11 * scale}px "${monoFamily(fonts)}", monospace`;
    ctx.fillStyle = "rgba(176,194,188,0.42)";
    const txt = copy.hudTag.toUpperCase();
    const spacing = 0.3 * 11 * scale;
    const width =
      [...txt].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, 0) -
      spacing;
    drawTracked(ctx, txt, W - 64 * scale - width, H - 30 * scale, spacing);
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
};

/** Paint L7 — the mandatory lower-left → transparent scrim (contrast floor). */
export const drawScrim = (ctx: SKRSContext2D, W: number, H: number): void => {
  const g = ctx.createLinearGradient(0, H, W * 0.55, H * 0.2);
  g.addColorStop(0, "rgba(3,4,10,0.7)");
  g.addColorStop(1, "rgba(3,4,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};
