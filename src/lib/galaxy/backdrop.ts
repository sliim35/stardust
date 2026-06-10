/**
 * Pure, seeded point geometry for the procedural backdrop disk (#4) — the
 * headless half of the canvas `GalaxyBackdrop` component. Recreates the
 * prototype's *output* (`galaxy.jsx` `PixelGalaxy`), reworked per the design
 * spec: a clean log-spiral (no central bar) with two bright primary arms and two faded
 * secondary ones (`docs/design/2026-06-02-explorable-galaxy.md` §"GalaxyBackdrop
 * rework").
 *
 * Density tuned per the 2026-06-03 visual-language pass (#50): enough points for
 * defined arms. The canvas renders these as soft additive glows (the owner-chosen
 * "soft-glow" direction — see the soft-glow direction design doc), so this module
 * only owns the seeded *positions*, never the texture.
 *
 * Everything is a deterministic function of `backdrop.seed` (mulberry32), so the
 * same seed yields byte-identical pixels (#4 AC1) and SSR/client never disagree.
 * `palette` is intentionally NOT read here — it only tints color downstream; the
 * geometry it produces is identical across palettes.
 */

import {
  DISK_TILT,
  GALAXY_CENTER,
  GALAXY_R,
  STAGE_H,
  STAGE_W,
} from "#/lib/galaxy/place";
import { clamp, mulberry32 } from "#/lib/galaxy/rng";
import type { GalaxyBackdrop } from "#/lib/galaxy/types";

/** One drawn pixel: position, crisp size, base brightness, and animation seeds. */
export type BackdropPoint = {
  x: number;
  y: number;
  size: 1 | 2;
  alpha: number; // base brightness 0..1
  phase: number; // 0..1 twinkle phase (the live overlay animates; geometry stays pure)
  warm: number; // 0..1 cool→warm tint mix, resolved against the palette by the canvas
};

/** The three structural point clouds the canvas paints back-to-front. */
export type BackdropGeometry = {
  bgStars: BackdropPoint[]; // faint full-stage field
  arms: BackdropPoint[]; // log-spiral arms
  bulge: BackdropPoint[]; // bright rounded core cloud
};

/**
 * Where a disk sits on the stage (ADR-0011 §1). The disk-polar → stage projection
 * scales by `r`, foreshortens the y axis by `tilt`, **then** rotates the projected
 * ellipse by `pa` (a true sky position angle, radians) and offsets to `(cx, cy)`.
 * This lets the *same* generator paint the home Milky Way and every Local-Group
 * neighbour — one renderer, not two (the proof:
 * `docs/design/proofs/2026-06-06-neighbour-in-scene-proof.png`).
 *
 * `pa` rotating AFTER the squash is what makes a steeply-inclined disk read
 * *diagonal* (the FINAL proof's Andromeda). A pre-squash rotation — the I-1
 * version — only phase-shifts the arms inside an axis-aligned ellipse, which no
 * authored data should ever need (slice I-2 fix).
 */
export type DiskPlacement = {
  cx: number; // disk centre x (stage px)
  cy: number; // disk centre y (stage px)
  r: number; // disk radius (stage px) — was the locked GALAXY_R
  tilt: number; // y-axis foreshortening (disk inclination)
  pa: number; // position angle — rotates the projected ellipse on the sky (radians)
};

/**
 * The default placement — the home Milky Way, derived from the locked stage
 * constants (`GALAXY_CENTER` / `GALAXY_R` / `DISK_TILT`, no rotation). **With this
 * default the projection reduces EXACTLY to the pre-I-1 `toStage` (pa:0 ⇒
 * cos(θ+0)=cos θ), so the default render is byte-identical to today** (ADR-0011 §1,
 * the byte-identical invariant — no MW pixel, seed, or test moves).
 */
export const MW_PLACEMENT: DiskPlacement = {
  cx: GALAXY_CENTER.x,
  cy: GALAXY_CENTER.y,
  r: GALAXY_R,
  tilt: DISK_TILT,
  pa: 0,
};

const TAU = Math.PI * 2;
const ARM_WIND = 1.8; // log-spiral winding: theta = base + ln(r/startR) * ARM_WIND
const START_R = 0.12; // inner radius where the arms begin

/**
 * Disk-polar (rNorm 0..1, theta rad) → stage pixels for one placement: scale by
 * `r`, foreshorten y by `tilt`, rotate the squashed point by `pa` (true position
 * angle — the ellipse itself turns), offset to `(cx, cy)`. At `MW_PLACEMENT`
 * (pa:0) this is the original `GALAXY_CENTER ± cos/sin·rNorm·GALAXY_R` verbatim —
 * the byte-identical default (ADR-0011 §1).
 */
const toStage = (
  rNorm: number,
  theta: number,
  place: DiskPlacement,
): { x: number; y: number } => {
  const rr = rNorm * place.r;
  const dx = Math.cos(theta) * rr;
  const dy = Math.sin(theta) * rr * place.tilt;
  const cosPa = Math.cos(place.pa);
  const sinPa = Math.sin(place.pa);
  return {
    x: place.cx + dx * cosPa - dy * sinPa,
    y: place.cy + dx * sinPa + dy * cosPa,
  };
};

/**
 * A placed disk's silhouette reach along one direction `(ux, uy)` (unit vector)
 * — the support function of the ellipse with semi-axes `(r, r·tilt)` rotated by
 * `pa`: how far the projected disk extends from its centre when measured along
 * that axis. The pairwise-separation guarantee of the LG composition (#167
 * sparseness) measures gaps along the centre-to-centre line with this — the
 * axis-aligned `placedExtent` over-reaches on diagonals (it bounds the box, not
 * the ellipse).
 */
export const placedSupport = (
  place: DiskPlacement,
  ux: number,
  uy: number,
): number => {
  // Project the direction onto the ellipse's own axes (major e1 = pa, minor
  // e2 = pa + 90°), then the support is √((r·u₁)² + (r·tilt·u₂)²).
  const cosPa = Math.cos(place.pa);
  const sinPa = Math.sin(place.pa);
  const u1 = ux * cosPa + uy * sinPa;
  const u2 = -ux * sinPa + uy * cosPa;
  return Math.hypot(place.r * u1, place.r * place.tilt * u2);
};

/**
 * The projected half-extents of a placed disk — the tight axis-aligned bounding
 * box of the ellipse with semi-axes `(r, r·tilt)` rotated by `pa` (the support
 * along the stage axes). The one place the silhouette bound lives: the LG
 * composition (labels clear of the disk, fit inside the stage) and the tests
 * read it instead of re-deriving the trig.
 */
export const placedExtent = (
  place: DiskPlacement,
): { x: number; y: number } => ({
  x: placedSupport(place, 1, 0),
  y: placedSupport(place, 0, 1),
});

/**
 * Project one disk-polar point into a placed, stage-clamped `BackdropPoint`. Exported
 * so the `shape`→recipe map (`galaxy-render.ts`, ADR-0011 §1) reuses the *same*
 * projection + `Math.round` quantization + stage clamp + RNG-driven size as the
 * spiral generator — one renderer, not two. Pure + SSR-safe (`mulberry32`-fed `rng`).
 */
export const pointAt = (
  rNorm: number,
  theta: number,
  rng: () => number,
  alpha: number,
  warm: number,
  bigChance: number,
  place: DiskPlacement,
): BackdropPoint => {
  const p = toStage(rNorm, theta, place);
  return {
    x: clamp(Math.round(p.x), 0, STAGE_W),
    y: clamp(Math.round(p.y), 0, STAGE_H),
    size: rng() < bigChance ? 2 : 1,
    alpha,
    phase: rng(),
    warm,
  };
};

/**
 * The xor fold that derives a recipe's *bulge/core* rng stream from its arm
 * seed — independent streams, so tuning one never reshuffles the other. One
 * owner for the convention: every geometry recipe (here + `galaxy-render.ts`)
 * folds with this same constant.
 */
export const BULGE_STREAM_XOR = 0xc2b2ae35;

/**
 * The placed arm + bulge point clouds — the disk *body* shared by the home Milky Way
 * (`buildBackdropGeometry`) and every Local-Group neighbour (`galaxy-render.ts`'s
 * spiral recipe), so the two stay in ONE visual family by construction (no drift if
 * the arm/core tuning ever changes). Independent seeded streams (xor-folded) so
 * tuning one never reshuffles the other; `place` decides where/how it lands on the
 * stage. Pure + SSR-safe. (Extracted in the I-1 review — was copied between callers.)
 */
export const buildArmsAndBulge = (
  tuning: GalaxyBackdrop,
  place: DiskPlacement,
): { arms: BackdropPoint[]; bulge: BackdropPoint[] } => {
  const { seed, branches, spin, randomnessPower } = tuning;
  const armRng = mulberry32(seed);
  const bulgeRng = mulberry32(seed ^ BULGE_STREAM_XOR);

  const arms: BackdropPoint[] = [];
  for (let arm = 0; arm < branches; arm++) {
    const primary = arm % 2 === 0; // alternate bright / faded arms
    const armBase = (arm / branches) * TAU;
    const count = primary ? 560 : 260;
    const spread = primary ? 0.14 : 0.26; // tighter primaries read more clearly
    const fade = primary ? 1 : 0.62;
    for (let i = 0; i < count; i++) {
      const rNorm = START_R + (1 - START_R) * armRng() ** 0.85;
      const theta =
        armBase +
        Math.log(rNorm / START_R) * ARM_WIND * spin +
        (armRng() - 0.5) * spread;
      arms.push(
        pointAt(
          rNorm,
          theta,
          armRng,
          (0.42 + armRng() * 0.48) * fade,
          0.35 + armRng() * 0.6,
          0.12,
          place,
        ),
      );
    }
  }

  // Rounded core cloud — no central bar (the owner disliked the horizontal
  // streak); the bulge alone carries the bright centre.
  const bulge: BackdropPoint[] = [];
  for (let i = 0; i < 560; i++) {
    const rNorm = bulgeRng() ** randomnessPower * 0.24; // power-biased toward the core
    const theta = bulgeRng() * TAU;
    bulge.push(
      pointAt(
        rNorm,
        theta,
        bulgeRng,
        0.5 + bulgeRng() * 0.45,
        0.6 + bulgeRng() * 0.4,
        0.4,
        place,
      ),
    );
  }

  return { arms, bulge };
};

export const buildBackdropGeometry = (
  backdrop: GalaxyBackdrop,
  place: DiskPlacement = MW_PLACEMENT,
): BackdropGeometry => {
  // The full-stage deep field is the home backdrop's alone (a neighbour never adds
  // its own stipple) — its own xor-folded stream. The disk body (arms + bulge) comes
  // from the shared `buildArmsAndBulge`, so the home + neighbours never drift apart.
  const bgRng = mulberry32(backdrop.seed ^ 0x9e3779b9);
  const bgStars: BackdropPoint[] = [];
  for (let i = 0; i < 560; i++) {
    bgStars.push({
      x: Math.round(bgRng() * STAGE_W),
      y: Math.round(bgRng() * STAGE_H),
      size: bgRng() < 0.1 ? 2 : 1,
      alpha: 0.1 + bgRng() * 0.32,
      phase: bgRng(),
      warm: bgRng(),
    });
  }

  const { arms, bulge } = buildArmsAndBulge(backdrop, place);
  return { bgStars, arms, bulge };
};
