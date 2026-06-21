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
  type ArmTuning,
  type BackdropGeometry,
  type BackdropPoint,
  BULGE_STREAM_XOR,
  buildArmsAndBulge,
  buildBackdropGeometry,
  buildDeepField,
  type DiskPlacement,
  MW_PLACEMENT,
  pointAt,
} from "#/lib/galaxy/backdrop";
import { DISK_TILT, GALAXY_R, polarToXY } from "#/lib/galaxy/place";
import { HOME_MILKY_WAY_ID, REAL_OBJECTS } from "#/lib/galaxy/realdata";
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
 * Per-galaxy grand-spiral tuning (#226, AC4), keyed by object id. MW is ABSENT →
 * the default (today's `ARM_WIND`/×1 spread) so its home path is byte-identical;
 * M31 reads as a tighter, grander Sb pinwheel (more winding, slimmer arms) than
 * the MW's SBbc. Hand-tuned, bake the values into the PR like the `FLOC` block.
 */
const GRAND_TUNING: Record<string, ArmTuning> = {
  andromeda: { wind: 2.5, spreadScale: 0.7 }, // tighter wound + slimmer arms
};

/**
 * The spiral recipe (barred-spiral / spiral) — delegates to the shared
 * `buildArmsAndBulge` (the SAME arm + core generator as the home disk), placement-
 * aware, WITHOUT the full-stage `bgStars` deep field (the MW backdrop owns the one
 * deep field; a neighbour contributes only its own disk). One generator, no drift.
 * `armTuning` (default `{}` = MW literals) is the per-galaxy grand differentiation.
 */
const buildSpiralGeometry = (
  tuning: GalaxyBackdrop,
  place: DiskPlacement,
  armTuning: ArmTuning = {},
): BackdropGeometry => {
  // Reuse the SAME arm+bulge generator as the home disk (one visual family); a
  // neighbour contributes no full-stage deep field, so bgStars stays empty.
  const { arms, bulge } = buildArmsAndBulge(tuning, place, armTuning);
  return { bgStars: [], arms, bulge };
};

/**
 * Flocculent tuning (M33, owner pass 2026-06-10). One knob set = one look; the
 * variant bake-off values live in the PR. The character vs the grand-design MW:
 * arms are LOOSE (less wound), BEADED (short patchy knots strung along the
 * spiral flow, not continuous lanes), the core is tiny, and a faint inter-arm
 * sprinkle blends the patches into one disk.
 */
const FLOC = {
  startR: 0.14, // arms start just off the small core
  wind: 0.95, // log-spiral winding — much looser than the MW's 1.8
  knotsPerArm: 7,
  pointsPerKnot: 58,
  knotSpread: { min: 0.07, max: 0.15 }, // per-knot fuzz (disk fraction)
  knotJitter: 0.22, // angular scatter off the exact spiral path (radians)
  fieldPoints: 260, // faint inter-arm sprinkle (one disk, not loose beads)
  coreCount: 200, // real M33's nucleus is tiny next to the MW bulge
  coreReach: 0.12,
} as const;

/**
 * The flocculent recipe (M33) — short star-forming patches *beaded along* a
 * loosely-wound spiral flow, instead of the MW generator's continuous arms.
 * Knot centres follow `theta = base + ln(r/startR)·wind` (the same log-spiral
 * family, so it still reads as a pinwheel in motion direction), but each knot
 * scatters its own round fuzz and the arm between knots stays dark — the
 * patchy, broken look that separates M33 from a grand-design twin. Same
 * `pointAt` path as every other recipe (soft glow, clamp, SSR-safe quantize).
 */
const buildFlocculentGeometry = (
  tuning: GalaxyBackdrop,
  place: DiskPlacement,
): BackdropGeometry => {
  const rng = mulberry32(tuning.seed);
  const arms: BackdropPoint[] = [];

  for (let arm = 0; arm < tuning.branches; arm++) {
    const armBase = (arm / tuning.branches) * TAU;
    for (let k = 0; k < FLOC.knotsPerArm; k++) {
      // Even radial ladder + jitter → beads from the core edge to the rim.
      const t = (k + 0.35 + rng() * 0.5) / FLOC.knotsPerArm;
      const kr = FLOC.startR + (0.95 - FLOC.startR) * t;
      const ktheta =
        armBase +
        Math.log(kr / FLOC.startR) * FLOC.wind +
        (rng() - 0.5) * FLOC.knotJitter;
      const spread =
        FLOC.knotSpread.min +
        rng() * (FLOC.knotSpread.max - FLOC.knotSpread.min);
      const kx = Math.cos(ktheta) * kr;
      const ky = Math.sin(ktheta) * kr;
      // Outer knots fade — real flocculents dim toward the rim.
      const fade = 1 - 0.45 * t;
      for (let i = 0; i < FLOC.pointsPerKnot; i++) {
        const px = kx + (rng() + rng() - 1) * spread;
        const py = ky + (rng() + rng() - 1) * spread;
        const rNorm = Math.min(Math.hypot(px, py), 1);
        const theta = Math.atan2(py, px);
        arms.push(
          pointAt(
            rNorm,
            theta,
            rng,
            (0.38 + rng() * 0.42) * fade,
            0.3 + rng() * 0.5,
            0.1,
            place,
          ),
        );
      }
    }
  }

  // Faint inter-arm sprinkle so the beads read as ONE low-surface-brightness
  // disk (the #151 lesson: never disconnected blobs).
  for (let i = 0; i < FLOC.fieldPoints; i++) {
    const rNorm = FLOC.startR + (0.9 - FLOC.startR) * rng() ** 0.7;
    const theta = rng() * TAU;
    arms.push(
      pointAt(
        rNorm,
        theta,
        rng,
        0.16 + rng() * 0.2,
        0.3 + rng() * 0.4,
        0,
        place,
      ),
    );
  }

  // The tiny nucleus — much smaller + quieter than the MW-family bulge.
  const bulgeRng = mulberry32(tuning.seed ^ BULGE_STREAM_XOR);
  const bulge: BackdropPoint[] = [];
  for (let i = 0; i < FLOC.coreCount; i++) {
    const rNorm = bulgeRng() ** 2.4 * FLOC.coreReach;
    const theta = bulgeRng() * TAU;
    bulge.push(
      pointAt(
        rNorm,
        theta,
        bulgeRng,
        0.45 + bulgeRng() * 0.4,
        0.5 + bulgeRng() * 0.4,
        0.3,
        place,
      ),
    );
  }

  return { bgStars: [], arms, bulge };
};

const CLUMP_COUNT = 6; // a handful of star-forming knots — the magellanic look
const CLUMP_POINTS = 185; // points scattered around each knot
const CLUMP_REACH = 0.55; // knot centres stay inside this disk fraction…
const CLUMP_SPREAD = { min: 0.18, max: 0.38 }; // …and their fuzz overlaps (one cloud)

/**
 * The clumpy recipe (magellanic / irregular) — the Magellanic Cloud has
 * no clean spiral arms; it reads as ONE lumpy, structureless cloud of overlapping
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
 * Barred-irregular tuning (LMC = SBm, #226). The bar is authored along DISK-SPACE
 * angle 0, so the placement's `pa` (= the authored `barAngle`) rotates it onto the
 * sky exactly like the spiral arms. One ragged arm hangs off the +x bar end; the
 * scatter is biased toward that side so the silhouette is lopsided (the Magellanic
 * signature) — not the radially-symmetric blob the bar-less clumpy recipe gives.
 */
const BAR = {
  count: 240, // points along the central stellar bar
  halfLen: 0.5, // bar reaches ±0.5·r along the disk x-axis
  thick: 0.07, // gaussian-ish half-thickness across the bar
  armKnots: 3, // a single ragged arm = a few beaded knots off the +x bar end
  armPointsPerKnot: 70,
  armSpread: { min: 0.08, max: 0.16 },
  scatterBias: 0.32, // shove the clump cloud toward +x so the disk reads lopsided
} as const;

/**
 * The barred-irregular recipe (LMC / SBm) — a central stellar bar + ONE ragged
 * asymmetric arm trailing off it + a lopsided clumpy scatter. The bar lives in
 * disk space (angle 0) so `place.pa` turns it on the sky; the arm + the off-centre
 * scatter break radial symmetry the way the real Magellanic Cloud does. Same
 * `pointAt` projection as every recipe (soft glow, clamp, SSR-safe quantize).
 */
const buildBarredIrregularGeometry = (
  tuning: GalaxyBackdrop,
  place: DiskPlacement,
): BackdropGeometry => {
  const rng = mulberry32(tuning.seed);
  const arms: BackdropPoint[] = [];

  // The bar: points strung along the disk x-axis with gaussian cross-thickness.
  for (let i = 0; i < BAR.count; i++) {
    const along = (rng() * 2 - 1) * BAR.halfLen; // ±halfLen on the bar axis
    const across = (rng() + rng() - 1) * BAR.thick; // triangular thickness
    const rNorm = Math.min(Math.hypot(along, across), 1);
    const theta = Math.atan2(across, along);
    arms.push(
      pointAt(
        rNorm,
        theta,
        rng,
        0.5 + rng() * 0.4,
        0.4 + rng() * 0.5,
        0.18,
        place,
      ),
    );
  }

  // One ragged arm: a few beaded knots hung off the +x bar end, swept to one side.
  const armRoot = { x: BAR.halfLen, y: 0 };
  for (let k = 0; k < BAR.armKnots; k++) {
    const t = (k + 1) / BAR.armKnots;
    // The knots curl up-and-out from the bar end (one direction only = asymmetry).
    const kx = armRoot.x + 0.18 * t;
    const ky = armRoot.y + 0.42 * t;
    const spread =
      BAR.armSpread.min + rng() * (BAR.armSpread.max - BAR.armSpread.min);
    for (let i = 0; i < BAR.armPointsPerKnot; i++) {
      const px = kx + (rng() + rng() - 1) * spread;
      const py = ky + (rng() + rng() - 1) * spread;
      const rNorm = Math.min(Math.hypot(px, py), 1);
      const theta = Math.atan2(py, px);
      arms.push(
        pointAt(
          rNorm,
          theta,
          rng,
          0.36 + rng() * 0.4,
          0.35 + rng() * 0.5,
          0.12,
          place,
        ),
      );
    }
  }

  // Lopsided scatter: the clump cloud, but shoved toward +x so the silhouette is
  // weighted to the bar/arm side rather than radially symmetric.
  const clumps = Array.from({ length: CLUMP_COUNT }, () => {
    const r = rng() ** 1.2 * CLUMP_REACH;
    const ang = rng() * TAU;
    return {
      x: Math.cos(ang) * r + BAR.scatterBias,
      y: Math.sin(ang) * r,
      spread: CLUMP_SPREAD.min + rng() * (CLUMP_SPREAD.max - CLUMP_SPREAD.min),
    };
  });
  for (const c of clumps) {
    for (let i = 0; i < CLUMP_POINTS; i++) {
      const px = c.x + (rng() + rng() - 1) * c.spread;
      const py = c.y + (rng() + rng() - 1) * c.spread;
      const rNorm = Math.min(Math.hypot(px, py), 1);
      const theta = Math.atan2(py, px);
      arms.push(
        pointAt(
          rNorm,
          theta,
          rng,
          0.34 + rng() * 0.36,
          0.3 + rng() * 0.5,
          0.12,
          place,
        ),
      );
    }
  }

  // A faint off-centre core — the LMC's centre of mass sits on the bar, not at 0.
  const bulgeRng = mulberry32(tuning.seed ^ BULGE_STREAM_XOR);
  const bulge: BackdropPoint[] = [];
  for (let i = 0; i < 150; i++) {
    const px = (bulgeRng() + bulgeRng() - 1) * 0.16 + 0.06;
    const py = (bulgeRng() + bulgeRng() - 1) * 0.12;
    const rNorm = Math.min(Math.hypot(px, py), 1);
    const theta = Math.atan2(py, px);
    bulge.push(
      pointAt(
        rNorm,
        theta,
        bulgeRng,
        0.42 + bulgeRng() * 0.36,
        0.45 + bulgeRng() * 0.4,
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
 * The `shape`→recipe dispatch (ADR-0011 §1, the #226 amendment): one source of
 * truth shared by the LG-overview path (`buildGalaxyGeometry`, bgStars empty) and
 * the entered-galaxy seam (`buildEnteredGalaxyGeometry`, with a deep field). Every
 * recipe returns `bgStars:[]`; the caller decides whether to add the deep field.
 *
 * v1 recipe map: barred-spiral / spiral reuse the arm+core generator with a
 * per-galaxy grand tuning (MW = today's literals → byte-identical; M31 = a tighter,
 * grander pinwheel); flocculent-spiral (M33) gets the beaded-knot builder;
 * magellanic (LMC = SBm) gets the barred-irregular builder (bar + ragged arm +
 * lopsided scatter); irregular / dwarf-spheroidal (M31's satellites) fall through
 * to the bar-less clumpy variant. The map is the seam #155 / #127 extend later.
 */
const dispatchDiskGeometry = (
  o: RealObject,
  place: DiskPlacement,
): BackdropGeometry => {
  const tuning = tuningFor(o);
  switch (o.shape) {
    case "barred-spiral":
    case "spiral":
      return buildSpiralGeometry(tuning, place, GRAND_TUNING[o.id]);
    case "flocculent-spiral":
      // M33 (owner pass 2026-06-10): beaded patchy arms, not a MW twin.
      return buildFlocculentGeometry(tuning, place);
    case "magellanic":
      // LMC (#226): a barred-irregular SBm — bar + ragged arm + lopsided scatter.
      return buildBarredIrregularGeometry(tuning, place);
    default:
      // irregular / dwarf-spheroidal (+ any non-disk fallthrough)
      return buildClumpyGeometry(tuning, place);
  }
};

/**
 * Render-capability for ONE real object on the LG OVERVIEW (ADR-0011 §1): the
 * `shape`-dispatched soft-glow disk at `place`, WITHOUT a deep field — the home MW
 * backdrop owns the one full-stage stipple; a neighbour seen from outside adds only
 * its own disk.
 */
export const buildGalaxyGeometry = (
  o: RealObject,
  place: DiskPlacement = placementFor(o),
): BackdropGeometry => dispatchDiskGeometry(o, place);

/**
 * Render-capability for ONE real object on the ENTERED (tier-2) view (#226, the
 * ADR-0011 §1 amendment). The fix for #225: when you DESCEND into a neighbour the
 * home MW disk is gone, so this seam paints the galaxy's OWN `shape`-dispatched disk
 * (M33 flocculent, LMC barred-irregular, M31 a grander spiral than the MW) PLUS its
 * own full-stage deep field — instead of the shape-agnostic grand spiral the old
 * `buildBackdropGeometry` path wore for every entered galaxy. Pure + SSR-safe; the
 * home Milky Way keeps its untouched `buildBackdropGeometry(backdrop, MW_PLACEMENT)`.
 */
export const buildEnteredGalaxyGeometry = (
  o: RealObject,
  place: DiskPlacement = placementFor(o),
): BackdropGeometry => {
  const { arms, bulge } = dispatchDiskGeometry(o, place);
  return { bgStars: buildDeepField(hashStr(o.id)), arms, bulge };
};

/**
 * The entered-galaxy builder selection (#226): a displayed galaxy id → the real
 * neighbour whose own morphology the entered backdrop must paint, or `null` for the
 * home Milky Way (`HOME_MILKY_WAY_ID` / `null` / unknown) — which keeps its untouched
 * `buildBackdropGeometry` path. The one place `GalaxyBackdrop` asks "am I inside a
 * neighbour?" so the component stays declarative and the choice stays unit-tested.
 */
export const enteredObjectFor = (
  galaxyId: string | null | undefined,
): RealObject | null => {
  if (!galaxyId || galaxyId === HOME_MILKY_WAY_ID) return null;
  return REAL_OBJECTS.find((o) => o.id === galaxyId) ?? null;
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
