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
  buildBackdropGeometry,
  type DiskPlacement,
  MW_PLACEMENT,
  pointAt,
} from "#/lib/galaxy/backdrop";
import { DISK_TILT, GALAXY_R, polarToXY } from "#/lib/galaxy/place";
import { HOME_MILKY_WAY_ID } from "#/lib/galaxy/realdata";
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

const CLUMP_COUNT = 6; // a handful of star-forming knots — the magellanic look
const CLUMP_POINTS = 185; // points scattered around each knot
const CLUMP_REACH = 0.55; // knot centres stay inside this disk fraction…
const CLUMP_SPREAD = { min: 0.18, max: 0.38 }; // …and their fuzz overlaps (one cloud)

/**
 * The clumpy recipe (magellanic / irregular) — the Magellanic Clouds and the SMC have
 * no clean spiral arms; they read as ONE lumpy, structureless cloud of overlapping
 * bright star-forming knots (the FINAL proof's ragged clouds — not disconnected
 * blobs, the first I-2 cut's mistake). Knot centres stay inside `CLUMP_REACH`
 * with wide per-knot fuzz so the knots blend; the scatter is disk-cartesian
 * (round knots, no banana arcs), then converted to polar for the *same* `pointAt`
 * (so the soft-glow surface, clamp, and SSR-safe quantization match the spirals).
 * Output goes in `arms` (the main cloud) + a small `bulge` (a faint brighter core)
 * so the canvas paints it back-to-front exactly like a spiral — same `paintGlow`
 * path, no forked renderer.
 */
const buildClumpyGeometry = (
  tuning: GalaxyBackdrop,
  place: DiskPlacement,
): BackdropGeometry => {
  const rng = mulberry32(tuning.seed);

  // Seed the clump centres first (disk-cartesian), so the scatter loop reads
  // stable knots. Centre-biased so the cloud has a dense heart.
  const clumps = Array.from({ length: CLUMP_COUNT }, () => {
    const r = rng() ** 1.2 * CLUMP_REACH;
    const ang = rng() * TAU;
    return {
      x: Math.cos(ang) * r,
      y: Math.sin(ang) * r,
      spread: CLUMP_SPREAD.min + rng() * (CLUMP_SPREAD.max - CLUMP_SPREAD.min),
    };
  });

  const arms: BackdropPoint[] = [];
  for (const c of clumps) {
    for (let i = 0; i < CLUMP_POINTS; i++) {
      // Triangular-distributed offsets → soft round knots that fade outward.
      const px = c.x + (rng() + rng() - 1) * c.spread;
      const py = c.y + (rng() + rng() - 1) * c.spread;
      const rNorm = Math.min(Math.hypot(px, py), 1);
      const theta = Math.atan2(py, px);
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
 * One real galaxy placed somewhere on the stage — what a tier composition (the
 * Local-Group scene, `lg-composition.ts`) hands the renderer: the curated object
 * plus the `DiskPlacement` the active tier wants it painted at.
 */
export type PlacedGalaxy = {
  object: RealObject;
  place: DiskPlacement;
};

/**
 * Render-capability for ONE real object (ADR-0011 §1): pick the geometry recipe from
 * the object's `shape`, build it at `place` (default: the object's raw data
 * placement; a tier composition like the LG scene passes its own — the I-2 seam) +
 * tuning, and return the placed soft-glow point clouds the canvas paints with the
 * existing `paintGlow` + `paletteFor`. `bgStars` is always empty — the home MW
 * backdrop owns the one deep field; a neighbour contributes only its own disk.
 *
 * v1 recipe map: barred-spiral / spiral reuse the arm+core generator; magellanic /
 * irregular use the clumpy variant; dwarf-spheroidal (M31's satellites) falls through
 * to the clumpy variant too (a small structureless blob). The map is the seam #155 /
 * #127 extend later.
 */
export const buildGalaxyGeometry = (
  o: RealObject,
  place: DiskPlacement = placementFor(o),
): BackdropGeometry => {
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

/**
 * Bloom tuning for the LG hover highlight (#174): the hovered galaxy's own point
 * cloud lights up via a SECOND additive pass over the same `arms`+`bulge`. The
 * spread (`×1.25`) widens each glow sprite a touch and `×0.9` (clamped at 1 in the
 * paint) lifts its alpha — bright enough to read as "this is the one you're
 * pointing at" without re-approaching the rejected flat gradient blob (#151/#155).
 * Kept here as the single source for the constants the canvas paints with.
 */
export const BLOOM_TUNING = { diameterScale: 1.25, alphaScale: 0.9 } as const;

/**
 * The bloom payload for an LG hover (#174): given the highlighted hit-target id,
 * resolve the points to re-paint brighter — that silhouette's own `arms`+`bulge`,
 * and **never `bgStars`** (the deep field must not flash). The id space is the
 * `lgHitTargets()` space: the MW gateway is `HOME_MILKY_WAY_ID`, blooming its
 * LG-placement disk geometry (`homePlacement` — the shrunk `LG_MW_PLACEMENT` at
 * the LG tier); every other id matches a placed neighbour's `object.id` and blooms
 * that neighbour's geometry at the placement the composition chose. No match (or
 * no highlight) → no bloom. Pure + deterministic, like every render mapper here.
 */
export const bloomPointsFor = (
  highlight: string | null | undefined,
  {
    backdrop,
    homePlacement = MW_PLACEMENT,
    neighbours,
  }: {
    backdrop: GalaxyBackdrop;
    homePlacement?: DiskPlacement;
    neighbours: readonly PlacedGalaxy[];
  },
): readonly BackdropPoint[] => {
  if (!highlight) return [];
  // The MW gateway blooms its home disk — arms + bulge only, dropping the one
  // full-stage `bgStars` field the home backdrop owns (it must never light up).
  if (highlight === HOME_MILKY_WAY_ID) {
    const { arms, bulge } = buildBackdropGeometry(backdrop, homePlacement);
    return [...arms, ...bulge];
  }
  const hit = neighbours.find((n) => n.object.id === highlight);
  if (!hit) return [];
  const { arms, bulge } = buildGalaxyGeometry(hit.object, hit.place);
  return [...arms, ...bulge];
};
