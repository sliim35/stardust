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
import {
  DISK_TILT,
  GALAXY_CENTER,
  GALAXY_R,
  polarToXY,
  STAGE_H,
  STAGE_W,
} from "#/lib/galaxy/place";
import { HOME_MILKY_WAY_ID, REAL_OBJECTS } from "#/lib/galaxy/realdata";
import { clamp, hashStr, mulberry32 } from "#/lib/galaxy/rng";
import type { GalaxyBackdrop, RealObject, RealShape } from "#/lib/galaxy/types";

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

/** Per-galaxy grand-spiral overrides keyed by id (#226, AC4); MW absent → byte-identical default. */
const GRAND_TUNING = {
  andromeda: { wind: 2.5, spreadScale: 0.7 }, // tighter wound + slimmer arms
} as const satisfies Record<string, ArmTuning>;

/** Spiral recipe — reuses the shared `buildArmsAndBulge` generator (one visual family, no drift); `armTuning` carries the per-galaxy grand differentiation. */
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

/** Barred-irregular tuning (LMC = SBm, #226); bar in disk space (angle 0), one ragged arm + lopsided scatter off the +x end. */
const BAR = {
  count: 240, // points along the central stellar bar
  halfLen: 0.5, // bar reaches ±0.5·r along the disk x-axis
  thick: 0.07, // gaussian-ish half-thickness across the bar
  armKnots: 3, // a single ragged arm = a few beaded knots off the +x bar end
  armPointsPerKnot: 70,
  armSpread: { min: 0.08, max: 0.16 },
  scatterBias: 0.32, // shove the clump cloud toward +x so the disk reads lopsided
} as const;

/** Barred-irregular recipe (LMC / SBm) — bar + one ragged arm + lopsided scatter break radial symmetry like the real Magellanic Cloud. */
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

// ── Tier-3 Solar System: soft-glow point/halo recipe (ADR-0016 §3) ─────────────
// A planet (and Sol) is a single soft-glow POINT object — NOT a disk. ADR-0011's
// disk recipes scatter hundreds of points across `GALAXY_R·size` (a fuzzy
// mini-galaxy); a point object needs its OWN compact recipe on the same seam, so
// `star`/`planet`/`marker` route here instead of falling through to a disk recipe.
// Same `paintGlow` (`lighter`) + `paletteFor` family — one coherent cosmos.

/** The tier-3 ring radius at normalised r=1 — the design's `RX` (a touch over `GALAXY_R` so the outer ring fills the void). */
const SOLAR_RX = 440;
/** The tier-3 ecliptic foreshortening — the design's `TILT` (rings seen slightly from above). */
const SOLAR_TILT = 0.58;
/** Body silhouette radius (stage px) per unit `size` — Jupiter (size 0.8) reads clearly bigger than Mercury (0.225), all ≪ Sol. */
const SOLAR_BODY_PX = 18;
/** Sol's bloom radius (stage px) — the white-hot hero, wider than any planet sphere. */
const SOLAR_SUN_PX = 64;

/**
 * A tier-3 body (Sol or a planet, `realdata.ts`) → its screen `DiskPlacement` on
 * the ring ladder (ADR-0016 §2). Sol sits dead-centre (`placement.r:0` →
 * `GALAXY_CENTER`); planets sit on `RNORM[i]·SOLAR_RX` with the ecliptic
 * foreshortening — the same world-centre + tilt convention the MW uses (so the
 * dive lands cleanly). `r` is the body's own silhouette radius (sized by `size`),
 * NOT the orbital radius — it's how big the soft-glow sphere is painted.
 */
export const solarPlacementFor = (o: RealObject): DiskPlacement => {
  const a = o.placement.angle;
  const rr = o.placement.r * SOLAR_RX;
  return {
    cx: GALAXY_CENTER.x + Math.cos(a) * rr,
    cy: GALAXY_CENTER.y + Math.sin(a) * rr * SOLAR_TILT,
    r: (o.shape === "star" ? SOLAR_SUN_PX : SOLAR_BODY_PX) * o.size,
    tilt: SOLAR_TILT,
    pa: 0,
  };
};

/** Project a body-local cartesian offset (px) onto a stage-clamped, Math.round-quantized `BackdropPoint`. */
const bodyPoint = (
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  rng: () => number,
  alpha: number,
  warm: number,
  bigChance: number,
): BackdropPoint => ({
  x: clamp(Math.round(cx + dx), 0, STAGE_W),
  y: clamp(Math.round(cy + dy), 0, STAGE_H),
  size: rng() < bigChance ? 2 : 1,
  alpha,
  phase: rng(),
  warm,
});

/**
 * A planet as a soft-glow LIT SPHERE (ADR-0016 §3 / the design's per-frame sphere
 * shading): a compact filled disk of points whose brightness is biased toward the
 * Sol-facing limb — additive `paintGlow` then reads it as a lit sphere, shaded
 * toward the warm light at the centre, cool of Sol. Distinguishable by size +
 * colour only; no texture, no rings, no pixels. `warm` is low (the canvas tints it
 * to the cool palette); the lit limb is the brightest band.
 */
const buildPlanetGeometry = (
  o: RealObject,
  place: DiskPlacement,
): BackdropGeometry => {
  const rng = mulberry32(hashStr(o.id));
  const R = place.r;
  // Unit vector from the planet toward Sol (the system centre) = the lit direction.
  let lx = GALAXY_CENTER.x - place.cx;
  let ly = GALAXY_CENTER.y - place.cy;
  const d = Math.hypot(lx, ly) || 1;
  lx /= d;
  ly /= d;
  // Point budget scales with the silhouette so a bigger sphere stays smooth.
  const count = Math.round(70 + R * 7);
  const arms: BackdropPoint[] = [];
  for (let i = 0; i < count; i++) {
    // Centre-biased fill (sqrt) → a solid sphere, denser at the core.
    const rr = Math.sqrt(rng()) * R;
    const theta = rng() * TAU;
    const dx = Math.cos(theta) * rr;
    const dy = Math.sin(theta) * rr;
    // How far this point sits toward the lit limb (−1 dark side → +1 lit side).
    const lit = R > 0 ? (dx * lx + dy * ly) / R : 0;
    // Lit hemisphere bright, terminator soft, dark side dim — the sphere read.
    const shade = 0.32 + 0.68 * Math.max(0, lit * 0.5 + 0.5);
    arms.push(
      bodyPoint(
        place.cx,
        place.cy,
        dx,
        dy,
        rng,
        (0.34 + rng() * 0.3) * shade * o.brightness,
        0.2 + rng() * 0.3,
        0.08,
      ),
    );
  }
  // A faint atmosphere halo — a thin ring just past the limb (the design's
  // drop-shadow glow), so the sphere has a soft edge rather than a hard cutoff.
  const bulge: BackdropPoint[] = [];
  const haloCount = Math.round(18 + R * 2);
  for (let i = 0; i < haloCount; i++) {
    const theta = rng() * TAU;
    const rr = R * (0.9 + rng() * 0.5);
    bulge.push(
      bodyPoint(
        place.cx,
        place.cy,
        Math.cos(theta) * rr,
        Math.sin(theta) * rr,
        rng,
        (0.12 + rng() * 0.12) * o.brightness,
        0.25,
        0.04,
      ),
    );
  }
  return { bgStars: [], arms, bulge };
};

/**
 * Sol — the white-hot hero bloom (ADR-0016 §3 / the design's HD sun): a small dense
 * cluster of hot points at the centre (the photosphere + bright core) inside a wide
 * warm-gold halo. Brighter + denser than any planet; painted with the reserved gold
 * sprite (the caller routes a `star` body to the gold sprite so it never theme-tints,
 * like `lgGoldAccents`). `warm:1` everywhere → the hot/gold bucket.
 */
const buildSunGeometry = (
  o: RealObject,
  place: DiskPlacement,
): BackdropGeometry => {
  const rng = mulberry32(hashStr(o.id));
  const R = place.r;
  // The hot photosphere core — a dense, bright, centre-biased disk.
  const core = Math.round(R * 0.45);
  const arms: BackdropPoint[] = [];
  const coreCount = 220;
  for (let i = 0; i < coreCount; i++) {
    const rr = rng() ** 1.4 * core;
    const theta = rng() * TAU;
    arms.push(
      bodyPoint(
        place.cx,
        place.cy,
        Math.cos(theta) * rr,
        Math.sin(theta) * rr,
        rng,
        0.7 + rng() * 0.3,
        1,
        0.5,
      ),
    );
  }
  // The wide warm corona halo — fainter points spread to the full bloom radius.
  const bulge: BackdropPoint[] = [];
  const halo = 320;
  for (let i = 0; i < halo; i++) {
    const rr = (0.45 + rng() ** 0.6 * 0.55) * R;
    const theta = rng() * TAU;
    bulge.push(
      bodyPoint(
        place.cx,
        place.cy,
        Math.cos(theta) * rr,
        Math.sin(theta) * rr,
        rng,
        0.16 + rng() * 0.28 * (1 - rr / R),
        1,
        0.2,
      ),
    );
  }
  return { bgStars: [], arms, bulge };
};

/** A bare point marker (Sgr A* / Orion-Arm label dots) — a single soft point + a tiny halo. */
const buildMarkerGeometry = (
  o: RealObject,
  place: DiskPlacement,
): BackdropGeometry => {
  const rng = mulberry32(hashStr(o.id));
  const R = Math.max(4, place.r);
  const arms: BackdropPoint[] = [];
  for (let i = 0; i < 24; i++) {
    const rr = Math.sqrt(rng()) * R * 0.5;
    const theta = rng() * TAU;
    arms.push(
      bodyPoint(
        place.cx,
        place.cy,
        Math.cos(theta) * rr,
        Math.sin(theta) * rr,
        rng,
        (0.4 + rng() * 0.4) * o.brightness,
        0.3 + rng() * 0.4,
        0.1,
      ),
    );
  }
  return { bgStars: [], arms, bulge: [] };
};

/**
 * The point/halo recipe for a point object (`shape: 'star' | 'planet' | 'marker'`,
 * ADR-0016 §3) — Sol's hero bloom, a planet's lit sphere, or a bare marker, each a
 * compact soft-glow cloud (NOT a disk). Pure + SSR-safe (`hashStr(o.id)` seed,
 * `Math.round`-quantized). The caller paints `star` with the reserved gold sprite.
 */
export const buildPointGeometry = (
  o: RealObject,
  place: DiskPlacement = solarPlacementFor(o),
): BackdropGeometry => {
  switch (o.shape) {
    case "star":
      return buildSunGeometry(o, place);
    case "planet":
      return buildPlanetGeometry(o, place);
    default:
      return buildMarkerGeometry(o, place);
  }
};

/** One placed tier-3 body: the object, its point geometry, and whether it paints with the reserved gold sprite (Sol) vs the cool palette (planets). */
export type PlacedBody = {
  object: RealObject;
  geometry: BackdropGeometry;
  gold: boolean;
};

/** A faint tilted orbital ring ellipse, Sol-centred (ADR-0016 §2): `rx`/`ry` are the foreshortened semi-axes. */
export type SolarRing = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  alpha: number;
};

/**
 * The whole tier-3 scene (ADR-0016 §2/§3, the imported design) as pure data the
 * `GalaxyBackdrop` paints: the 8 faint ecliptic ring ellipses, plus each body's
 * point/halo geometry split by sprite — Sol (`shape:'star'`) on the reserved gold
 * sprite (never theme-tinted, like `lgGoldAccents`), the planets on the cool
 * palette. The component stays a thin painter; this owns the composition.
 */
export const buildSolarSystemScene = (
  bodies: readonly RealObject[],
): {
  bodies: readonly PlacedBody[];
  gold: readonly BackdropPoint[];
  cool: readonly BackdropPoint[];
  rings: readonly SolarRing[];
} => {
  const placed: PlacedBody[] = bodies.map((object) => {
    const place = solarPlacementFor(object);
    return {
      object,
      geometry: buildPointGeometry(object, place),
      gold: object.shape === "star",
    };
  });
  const gold: BackdropPoint[] = [];
  const cool: BackdropPoint[] = [];
  for (const b of placed) {
    const sink = b.gold ? gold : cool;
    sink.push(...b.geometry.arms, ...b.geometry.bulge);
  }
  // The faint ring ladder — the planets' orbital radii (`placement.r`), drawn as
  // foreshortened ellipses around Sol; outer rings a touch fainter (the design).
  const planetR = bodies
    .filter((o) => o.shape === "planet")
    .map((o) => o.placement.r)
    .sort((a, b) => a - b);
  const rings: SolarRing[] = planetR.map((r, i) => ({
    cx: GALAXY_CENTER.x,
    cy: GALAXY_CENTER.y,
    rx: r * SOLAR_RX,
    ry: r * SOLAR_RX * SOLAR_TILT,
    alpha: Math.max(0.07, 0.13 - i * 0.006),
  }));
  return { bodies: placed, gold, cool, rings };
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
 * Which recipe family each `RealShape` routes to — an exhaustive
 * `satisfies Record<RealShape, …>` map (the #177 pattern): the disk shapes paint
 * a galaxy disk, the point shapes (`star`/`planet`/`marker`) paint a soft-glow
 * point + halo (ADR-0016 §3, the latent mis-route of `star`/`marker` into the
 * clumpy disk recipe is fixed here). Adding a new `RealShape` fails the build
 * until it's classified — the renderer can never silently misroute a body.
 */
const RECIPE_FAMILY = {
  "barred-spiral": "disk",
  spiral: "disk",
  "flocculent-spiral": "disk",
  magellanic: "disk",
  irregular: "disk",
  "dwarf-spheroidal": "disk",
  nebula: "disk",
  star: "point",
  planet: "point",
  marker: "point",
} as const satisfies Record<RealShape, "disk" | "point">;

/** Which render family a `RealShape` belongs to — `'disk'` (galaxy point-cloud) or `'point'` (Sol/planet/marker soft-glow sphere). The exhaustive `RECIPE_FAMILY` is the single source. */
export const recipeFamilyFor = (shape: RealShape): "disk" | "point" =>
  RECIPE_FAMILY[shape];

/** The disk-family `shape`→recipe dispatch (#226); every recipe returns `bgStars:[]` so the caller owns the deep-field choice. */
const dispatchDiskGeometry = (
  o: RealObject,
  place: DiskPlacement,
): BackdropGeometry => {
  const tuning = tuningFor(o);
  switch (o.shape) {
    case "barred-spiral":
    case "spiral":
      return buildSpiralGeometry(
        tuning,
        place,
        GRAND_TUNING[o.id as keyof typeof GRAND_TUNING],
      );
    case "flocculent-spiral":
      // M33 (owner pass 2026-06-10): beaded patchy arms, not a MW twin.
      return buildFlocculentGeometry(tuning, place);
    case "magellanic":
      // LMC (#226): a barred-irregular SBm — bar + ragged arm + lopsided scatter.
      return buildBarredIrregularGeometry(tuning, place);
    default:
      // irregular / dwarf-spheroidal / nebula (disk-family fallthrough)
      return buildClumpyGeometry(tuning, place);
  }
};

/**
 * Render-capability for one real object: the `shape`-dispatched point cloud
 * WITHOUT a deep field (the home MW backdrop owns the one full-stage stipple). A
 * point shape (`star`/`planet`/`marker`, ADR-0016 §3) routes to the soft-glow
 * point/halo recipe; a disk shape to the galaxy-disk recipe — the `RECIPE_FAMILY`
 * map is the single classifier, so a point object can never fall through to a disk
 * recipe (the latent #177 mis-route, fixed structurally).
 */
export const buildGalaxyGeometry = (
  o: RealObject,
  place: DiskPlacement = placementFor(o),
): BackdropGeometry =>
  recipeFamilyFor(o.shape) === "point"
    ? buildPointGeometry(o, place)
    : dispatchDiskGeometry(o, place);

/** Entered (tier-2) render for one object: its OWN `shape`-dispatched disk PLUS its own deep field (the #225 fix — see PR #230). */
export const buildEnteredGalaxyGeometry = (
  o: RealObject,
  place: DiskPlacement = placementFor(o),
): BackdropGeometry => {
  const { arms, bulge } = dispatchDiskGeometry(o, place);
  return { bgStars: buildDeepField(hashStr(o.id)), arms, bulge };
};

/** Displayed galaxy id → the neighbour whose morphology the entered backdrop paints, or `null` for the home MW (keeps its untouched path) (#226). */
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
