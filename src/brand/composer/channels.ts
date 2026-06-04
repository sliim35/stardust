/**
 * Per-channel render config — native pixel grid (`NW×NH`), the integer upscale
 * `SCALE`, and the final export size. Drives the "uniform integer-scale grid"
 * invariant (#83 AC4/AC7): the scene is painted at `NW×NH` (1 drawn pixel = 1
 * grid cell), nearest-neighbour upscaled by an integer `SCALE`, then **cropped**
 * to the exact export size — never fractionally scaled.
 *
 * Owner-approved defaults (`docs/design/2026-06-03-pixel-scene-composer.md`
 * §"Composer defaults"): OG = 200×105 @ ×6 = 1200×630 exact; LinkedIn shares the
 * same grid and crops 3px to 627.
 */

export type Channel = "linkedin" | "og" | "avatar";

export type ChannelConfig = {
  /** Native canvas width in grid cells. */
  NW: number;
  /** Native canvas height in grid cells. */
  NH: number;
  /** Integer nearest-neighbour upscale factor. */
  SCALE: number;
  /** Final export width in px. */
  exportW: number;
  /** Final export height in px. */
  exportH: number;
};

export const CHANNELS = {
  // LinkedIn shares OG's 200×105·6 grid; 1200×630 upscale is cropped 3px to 627.
  linkedin: { NW: 200, NH: 105, SCALE: 6, exportW: 1200, exportH: 627 },
  // The reusable default card — exact 200×105·6 = 1200×630 (= the approved proof).
  og: { NW: 200, NH: 105, SCALE: 6, exportW: 1200, exportH: 630 },
  // Avatar reuses the ASTRO favicon tile (approved R3), not a scene crop; the
  // native grid is only a formal placeholder so the integer-scale invariant holds.
  avatar: { NW: 64, NH: 64, SCALE: 8, exportW: 512, exportH: 512 },
} as const satisfies Record<Channel, ChannelConfig>;

/** The exact export size (px) for a channel (#83 AC7). */
export const exportSizeFor = (channel: Channel): { w: number; h: number } => {
  const c = CHANNELS[channel];
  return { w: c.exportW, h: c.exportH };
};
