# brand/ — pixel-scene composer output

Outward-facing brand assets (LinkedIn posts, OG/social cards, avatar) **composed
by code** from the product's own pixel renderers — deterministic from
`{seed, channel, copy}`. The composer lives in
[`src/brand/composer/`](../src/brand/composer); these are its committed outputs.

Built for story **#83**; design spec (gitignored, local):
`docs/design/2026-06-03-pixel-scene-composer.md`.

## Regenerate

```bash
pnpm tsx src/brand/composer/render-cli.ts
# → brand/renders/<channel>/<name>.png + <name>.json
```

Each PNG ships with a `<name>.json` sidecar (`{seed, channel, NW, NH, SCALE,
pose, faceLeft, heroStar, …}`) so a render reproduces **cold** — same input ⇒
pixel-identical PNG.

## Compose one scene programmatically

```ts
import { composeScene } from "#/brand/composer";

const { png, sidecar } = await composeScene({
  channel: "og",            // "linkedin" 1200×627 · "og" 1200×630 · "avatar" 512
  seed: 424242,             // one seed → galaxy + starfield + planets
  pose: "point",            // idle | wave | point | celebrate   (default: point)
  expression: "A_curious",  // optional face override (selectable; no default)
  faceLeft: true,           // flip ASTRO to face the galaxy     (default: true)
  heroStar: true,           // gold memory star                  (default: true)
  headline: "every star here is a\nmemory someone left.",
  emphasis: "memory",       // one phrase in gold
  eyebrow: "Memory Galaxy",
  hudTag: "50,000 light-years",
});
```

## Channels

| Channel | Export | Native · SCALE | Notes |
|---|---|---|---|
| `og` | 1200×630 | 200×105 · ×6 (exact) | the reusable default card |
| `linkedin` | 1200×627 | 200×105 · ×6, cropped 3px | feed post |
| `avatar` | 512×512 | — | reuses the ASTRO favicon tile (not a scene crop) |

Grid is uniform by construction: the whole scene paints at native res, then
nearest-neighbour upscales by an **integer** `SCALE` (`imageSmoothingEnabled=false`
everywhere); overshoot is **cropped**, never fractionally scaled. ASTRO is 16
native cells ⇒ `16×SCALE` px on the export.
