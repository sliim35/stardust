/**
 * Render-set writer + the default committed render set. `writeRender` composes a
 * scene and writes `<out>/<channel>/<name>.png` plus a `<name>.json` sidecar so
 * any render is reproducible cold (#83 AC9). `DEFAULT_RENDER_SET` is the batch the
 * CLI (`render-cli.ts`) emits into `brand/renders/` — one per channel, including
 * the AC8 proof render that should match `proof-pixel-galaxy.png`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { composeScene } from "#/brand/composer/composeScene";
import type { ComposeSceneInput } from "#/brand/composer/types";

/** Compose `input` and write the PNG + JSON sidecar under `<outDir>/<channel>/`. */
export const writeRender = async (
  outDir: string,
  name: string,
  input: ComposeSceneInput,
): Promise<{ png: string; json: string }> => {
  const { png, sidecar } = await composeScene(input);
  const dir = join(outDir, input.channel);
  await mkdir(dir, { recursive: true });
  const pngPath = join(dir, `${name}.png`);
  const jsonPath = join(dir, `${name}.json`);
  await writeFile(pngPath, png);
  await writeFile(jsonPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  return { png: pngPath, json: jsonPath };
};

export type NamedRender = { name: string; input: ComposeSceneInput };

export const DEFAULT_RENDER_SET = [
  // The AC8 reference render — should match docs/.../proof-pixel-galaxy.png.
  {
    name: "proof-pixel-galaxy",
    input: {
      channel: "og",
      seed: 424242,
      pose: "idle",
      faceLeft: true,
      heroStar: false,
      eyebrow: "A tender memorial",
      headline: "Every star here is a memory\nsomeone left behind.",
      emphasis: "left behind.",
      hudTag: "50,000 light-years",
    },
  },
  // The owner-approved default brand card (point + hero star).
  {
    name: "brand-card",
    input: {
      channel: "og",
      seed: 424242,
      eyebrow: "Stardust",
      headline: "every star here is a\nmemory someone left.",
      emphasis: "memory",
      hudTag: "50,000 light-years",
    },
  },
  // LinkedIn post (same grid, cropped to 627).
  {
    name: "linkedin-launch",
    input: {
      channel: "linkedin",
      seed: 424242,
      pose: "wave",
      eyebrow: "Now in orbit",
      headline: "a small keeper for\nthe memories we leave.",
      emphasis: "keeper",
      hudTag: "50,000 light-years",
    },
  },
  // Avatar — the ASTRO favicon tile (seed-independent).
  { name: "astro-avatar", input: { channel: "avatar", seed: 0 } },
] as const satisfies readonly NamedRender[];
