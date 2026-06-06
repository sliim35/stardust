/**
 * Pure data→render mappers (ADR-0011 §1, slice I-1, #112) — the seam that turns a
 * curated `RealObject` (Layer A, `realdata.ts`) into the inputs the *existing*
 * `GalaxyBackdrop` renderer already paints. **One renderer, not two:** the home Milky
 * Way and every Local-Group neighbour come out of the same `buildBackdropGeometry`
 * + `pointAt` projection + `paintGlow` + `paletteFor`, differing only in placement +
 * tuning + the `shape`→recipe pick (the proof:
 * `docs/design/proofs/2026-06-06-neighbour-in-scene-proof.png`).
 *
 * Everything here is pure + SSR-safe (ADR-0003): the per-object seed is a
 * deterministic `hashStr(id)`, never `Math.random()` / `Date.now()`. The geometry is
 * a soft-glow point cloud — NOT crisp pixels, NOT gradient blobs (#151).
 *
 * Scope is I-1 (the render foundation): basic composition at each object's authored
 * data placement. Exact tier framing + scale-by-distance + depth/parallax bands are
 * I-2 / I-3 / I-4. The `shape`→recipe map is also the seam #155 (MW-interior
 * features) and #127 (Solar System) extend later.
 */

import {
  type BackdropGeometry,
  type BackdropPoint,
  buildArmsAndBulge,
  type DiskPlacement,
  pointAt,
} from "#/lib/galaxy/backdrop";
import { DISK_TILT, GALAXY_R, polarToXY } from "#/lib/galaxy/place";
import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import type { GalaxyBackdrop, RealObject } from "#/lib/galaxy/types";

const TAU = Math.PI * 2;

/** Branch budget for clumpy (magellanic / irregular) objects with no authored arms. */
const CLUMP_BRANCHES = 3;
/** The MW-matched winding + core bias so neighbours read in the same visual family. */
const DEFAULT_SPIN = 1;
const DEFAULT_RANDOMNESS_POWER = 2.2;

/**
 * A `RealObject` → its `DiskPlacement` on the stage (ADR-0011 §1). The centre is the
 * object's authored polar placement projected with the shared `polarToXY` (one
 * coordinate space); the disk radius scales by the object's relative `size` against
 * the locked `GALAXY_R`; `tilt` is the object's own inclination (default the MW tilt),
 * and the authored `barAngle` doubles as the disk position angle (`pa`).
 *
 * I-1 scope: radius = `GALAXY_R * size` is the basic-composition mapping; the
 * tier-framing + scale-by-distance refinement is I-3 / I-4.
 */
export const placementFor = (o: RealObject): DiskPlacement => {
  const centre = polarToXY(o.placement.r, o.placement.angle);
  return {
    cx: centre.x,
    cy: centre.y,
    r: GALAXY_R * o.size,
    tilt: o.tilt ?? DISK_TILT,
    pa: o.barAngle ?? 0,
  };
};

/**
 * A `RealObject` → a `GalaxyBackdrop`-shaped tuning for `buildBackdropGeometry`
 * (ADR-0011 §1): `arms → branches`, plus the MW-matched `spin` (=winding) and
 * `randomnessPower` (=core bias) so a neighbour reads in the same visual family. The
 * `palette` rides along for type-shape parity but the geometry is palette-independent
 * (the canvas tints downstream). The seed is a stable `hashStr(id)` — pure + SSR-safe,
 * and distinct per object so neighbours don't share a sky.
 */
export const tuningFor = (o: RealObject): GalaxyBackdrop => ({
  seed: hashStr(o.id),
  branches: o.arms ?? CLUMP_BRANCHES,
  spin: DEFAULT_SPIN,
  randomnessPower: DEFAULT_RANDOMNESS_POWER,
  palette: "ember",
});

/**
 * The spiral recipe (barred-spiral / spiral) — delegates to the shared
 * `buildArmsAndBulge` (the SAME arm + core generator as the home disk), placement-
 * aware, WITHOUT the full-stage `bgStars` deep field (the MW backdrop owns the one
 * deep field; a neighbour contributes only its own disk). One generator, no drift.
 */
const buildSpiralGeometry = (
  tuning: GalaxyBackdrop,
  place: DiskPlacement,
): BackdropGeometry => {
  // Reuse the SAME arm+bulge generator as the home disk (one visual family); a
  // neighbour contributes no full-stage deep field, so bgStars stays empty.
  const { arms, bulge } = buildArmsAndBulge(tuning, place);
  return { bgStars: [], arms, bulge };
};

const CLUMP_COUNT = 5; // a handful of star-forming knots — the magellanic look
const CLUMP_POINTS = 220; // points scattered around each knot

/**
 * The clumpy recipe (magellanic / irregular) — the Magellanic Clouds and the SMC have
 * no clean spiral arms; they read as a lumpy, structureless point cloud of bright
 * star-forming knots. We seed a few clump centres in the disk, scatter points tightly
 * around each, and project them through the *same* `pointAt` (so the soft-glow surface,
 * clamp, and SSR-safe quantization match the spirals). Output goes in `arms` (the main
 * cloud) + a small `bulge` (a faint brighter core) so the canvas paints it back-to-front
 * exactly like a spiral — same `paintGlow` path, no forked renderer.
 */
const buildClumpyGeometry = (
  tuning: GalaxyBackdrop,
  place: DiskPlacement,
): BackdropGeometry => {
  const rng = mulberry32(tuning.seed);

  // Seed the clump centres first (disk-polar), so the scatter loop reads stable knots.
  const clumps = Array.from({ length: CLUMP_COUNT }, () => ({
    r: rng() ** 1.4 * 0.85, // biased toward the centre, some out to the rim
    theta: rng() * TAU,
    tightness: 0.12 + rng() * 0.16,
  }));

  const arms: BackdropPoint[] = [];
  for (const c of clumps) {
    for (let i = 0; i < CLUMP_POINTS; i++) {
      const rNorm = Math.max(0, c.r + (rng() - 0.5) * c.tightness);
      const theta = c.theta + (rng() - 0.5) * c.tightness * 3;
      arms.push(
        pointAt(
          rNorm,
          theta,
          rng,
          0.4 + rng() * 0.4,
          0.3 + rng() * 0.5,
          0.14,
          place,
        ),
      );
    }
  }

  // A faint, soft core so the cloud has a centre of mass like a real dwarf.
  const bulge: BackdropPoint[] = [];
  for (let i = 0; i < 160; i++) {
    const rNorm = rng() ** 2 * 0.2;
    const theta = rng() * TAU;
    bulge.push(
      pointAt(
        rNorm,
        theta,
        rng,
        0.4 + rng() * 0.35,
        0.45 + rng() * 0.4,
        0.3,
        place,
      ),
    );
  }

  return { bgStars: [], arms, bulge };
};

/**
 * Render-capability for ONE real object (ADR-0011 §1): pick the geometry recipe from
 * the object's `shape`, build it at the object's data placement + tuning, and return
 * the placed soft-glow point clouds the canvas paints with the existing `paintGlow` +
 * `paletteFor`. `bgStars` is always empty — the home MW backdrop owns the one deep
 * field; a neighbour contributes only its own disk.
 *
 * v1 recipe map: barred-spiral / spiral reuse the arm+core generator; magellanic /
 * irregular use the clumpy variant; dwarf-spheroidal (M31's satellites) falls through
 * to the clumpy variant too (a small structureless blob). The map is the seam #155 /
 * #127 extend later.
 */
export const buildGalaxyGeometry = (o: RealObject): BackdropGeometry => {
  const place = placementFor(o);
  const tuning = tuningFor(o);
  switch (o.shape) {
    case "barred-spiral":
    case "spiral":
      return buildSpiralGeometry(tuning, place);
    default:
      // magellanic / irregular / dwarf-spheroidal (+ any non-disk fallthrough)
      return buildClumpyGeometry(tuning, place);
  }
};
