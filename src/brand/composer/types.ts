/**
 * Public types for the brand pixel-scene composer (#83). The `composeScene`
 * input mirrors the documented signature in the design spec §AC6.
 */

import type { Expression, Pose } from "#/brand/composer/astro";
import type { Channel } from "#/brand/composer/channels";

export type ComposeSceneInput = {
  /** Picks {NW, NH, SCALE} + layout offsets + export size. */
  channel: Channel;
  /** One seed drives the galaxy, starfield and planets — same seed ⇒ same scene. */
  seed: number;
  /** ASTRO body gesture. Owner-approved default: "point". */
  pose?: Pose;
  /** ASTRO face override (selectable; no owner-chosen default yet). */
  expression?: Expression;
  /** Flip ASTRO to face inward toward the galaxy. Default true (left placement). */
  faceLeft?: boolean;
  /** Light the gold L4 memory star. Owner-approved default: true. */
  heroStar?: boolean;
  /** Newsreader-italic headline (lower-left). */
  headline?: string;
  /** One headline phrase rendered in gold (#f5d6a0). */
  emphasis?: string;
  /** JetBrains-Mono uppercase kicker above the headline. */
  eyebrow?: string;
  /** Faint mono HUD tag, bottom-right (e.g. "50,000 light-years"). */
  hudTag?: string;
};

/** The reproducibility sidecar written next to every render (#83 AC9). */
export type SceneSidecar = {
  seed: number;
  channel: Channel;
  NW: number;
  NH: number;
  SCALE: number;
  /** ASTRO sprite height on the export = 16 × SCALE (the uniform-grid proof). */
  astroHeightPx: number;
  pose: Pose;
  expression: Expression | null;
  faceLeft: boolean;
  heroStar: boolean;
  headline: string | null;
  emphasis: string | null;
  eyebrow: string | null;
  hudTag: string | null;
};

export type ComposeSceneResult = {
  png: Buffer;
  sidecar: SceneSidecar;
};
