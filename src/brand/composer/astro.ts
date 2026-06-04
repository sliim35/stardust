/**
 * ASTRO sprite selection. The composer composites the **fixed 16×16 sprite** on
 * every scene (#83 AC6 — never re-diffused). Two selectable sprite sets:
 *
 * - **Pose** (body gesture): `idle | wave | point | celebrate` — the STARLIGHT
 *   poses. Owner-approved default is `point` (gesturing at the galaxy).
 * - **Expression** (face): `{A,B,C}_{calm,curious,happy,blink}` — the expressive
 *   full-body faces. Newly available; selectable, but **no default expression**
 *   is chosen here (flagged for the owner).
 *
 * Sprites are the committed copies under `src/brand/assets/astro/` (the runtime
 * must not reference the gitignored `astro/` source). They originate from the
 * single canonical set shared with app #70 — copied, not forked.
 */

import { fileURLToPath } from "node:url";

export const POSES = ["idle", "wave", "point", "celebrate"] as const;
export type Pose = (typeof POSES)[number];

export const EXPRESSIONS = [
  "A_calm",
  "A_curious",
  "A_happy",
  "A_blink",
  "B_calm",
  "B_curious",
  "B_happy",
  "B_blink",
  "C_calm",
  "C_curious",
  "C_happy",
  "C_blink",
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

const ASSETS = fileURLToPath(new URL("../assets/astro/", import.meta.url));

/**
 * Absolute path to the sprite for a given `{pose, expression}`. An explicit
 * `expression` overrides the `pose` body (the face sprite is full-body too).
 */
export const spritePathFor = ({
  pose,
  expression,
}: {
  pose: Pose;
  expression?: Expression;
}): string =>
  expression
    ? `${ASSETS}expression/${expression}.png`
    : `${ASSETS}poses/${pose}.png`;

/** Absolute path to the ASTRO favicon tile reused for the avatar channel (R3). */
export const faviconTilePath = (): string => `${ASSETS}favicon/tile-512.png`;
