/**
 * The Local-Group tier composition (slice I-2, #112) — pure math that turns the
 * curated dataset (`realdata.ts`) into the **scene the LG tier paints**, per the
 * locked FINAL proof (`docs/design/proofs/2026-06-05-local-group-tier-FINAL.png`):
 * the Milky Way shrunk to one point-cloud among the others (slightly low of the
 * screen centre), the 4 neighbours spread well clear of it in their proof
 * quadrants, gold accents (Sol's amber mark + globular-cluster sprinkles) on the
 * MW halo, and a serif/mono label anchor per galaxy.
 *
 * **The MW's world centre never moves** — it stays `GALAXY_CENTER` on every
 * tier; the LG view re-frames the camera instead (`LG_FRAMING`). That is what
 * makes the descend literally dive INTO the MW disk: the camera path ends on the
 * galaxy-tier rest (`GALAXY_CENTER`, zoom 1), which IS the MW's position in the
 * LG scene, and the threshold swap barely pops (only the `LG_MW_SCALE` shrink).
 *
 * **Neighbour spread** consumes the authored polar placements through a flattened
 * radial ring, `ρ(r) = base + gain·r` — monotone in `r`, so the §5.2 rule (nearer
 * reads nearer) survives, while the near-flat gain echoes the proof's even ring.
 * Sizes carry the ADR-0011 §2 scale-by-distance cue: far (Mly) galaxies shrink
 * harder than the near (ly) satellites. Depth/parallax bands + DOF stay slice I-3.
 *
 * Pure + SSR-safe (ADR-0003): constants + `mulberry32(hashStr(…))` — no clock,
 * no `Math.random()`, byte-stable across SSR and client.
 */

import {
  type BackdropPoint,
  type DiskPlacement,
  MW_PLACEMENT,
  placedExtent,
} from "#/lib/galaxy/backdrop";
import type { Camera } from "#/lib/galaxy/camera";
import { type PlacedGalaxy, placementFor } from "#/lib/galaxy/galaxy-render";
import { GALAXY_CENTER, GALAXY_R } from "#/lib/galaxy/place";
import {
  HOME_MILKY_WAY_ID,
  localGroupNeighbours,
  REAL_OBJECTS,
  SOL_ID,
} from "#/lib/galaxy/realdata";
import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import type { RealObject } from "#/lib/galaxy/types";

const TAU = Math.PI * 2;

/** The LG resting zoom — wide enough to seat the spread ring, < 1 so the descend dives in. */
const LG_ZOOM = 0.85;

/**
 * Where the MW reads on screen at the LG rest (the FINAL proof's anchor: roughly
 * centred, ~70px low). The framing below is derived from it, never authored raw.
 */
const LG_MW_SCREEN = { x: 632, y: 470 } as const;

/**
 * The LG resting camera, derived so the world-invariant MW (`GALAXY_CENTER`)
 * lands on the proof's screen anchor: `S = stage-centre + zoom·(W − camera)` ⇒
 * `camera = W − (S − stage-centre)/zoom`. Consumed by `tier-transition.ts` as
 * the `localGroup` tier framing.
 */
export const LG_FRAMING: Camera = {
  cx: GALAXY_CENTER.x - (LG_MW_SCREEN.x - GALAXY_CENTER.x) / LG_ZOOM,
  cy: GALAXY_CENTER.y - (LG_MW_SCREEN.y - GALAXY_CENTER.y) / LG_ZOOM,
  zoom: LG_ZOOM,
};

/**
 * The MW shrunk among its neighbours (FINAL proof) — still the largest disk.
 * 0.95 → 0.85 in the #167 sparseness pass (owner: "clear breathing room between
 * every pair"): the shrink frees central space without giving up the
 * largest-in-scene read; the threshold swap pop it costs stays a gentle step.
 */
const LG_MW_SCALE = 0.85;

/** The home disk at the LG tier: same world centre + orientation, smaller radius. */
export const LG_MW_PLACEMENT: DiskPlacement = {
  ...MW_PLACEMENT,
  r: GALAXY_R * LG_MW_SCALE,
};

/**
 * The flattened neighbour ring (world px): `ρ(r) = base + gain·r`. The gentle
 * gain keeps the authored distance order visible without collapsing the proof's
 * roughly-even spread; the flatten squashes the ring vertically so the 1280×800
 * stage reads like the proof's wide diorama. Retuned 460+140r → 540+80r in the
 * #167 sparseness pass: the higher base pushes the NEAR satellites (the pairs
 * that crowded the MW) well clear, while the flatter gain keeps the outermost
 * anchor (M33) inside the stage canvas — the ring stays monotone in `r`, so the
 * §5.2 nearer-reads-nearer order survives.
 */
const LG_RING = { base: 540, gain: 80 } as const;
const LG_FLATTEN = 0.5;

/**
 * Scale-by-distance (ADR-0011 §2, the I-2 slice of it): the far (Mly) anchors
 * render smaller relative to their authored size than the near (ly) satellites —
 * the proof's depth cue. Parallax bands + DOF are slice I-3. Both bands eased
 * down a notch (0.9/0.6 → 0.85/0.55) in the #167 sparseness pass — smaller
 * neighbours buy clear space everywhere while the near/far ratio (the cue)
 * barely moves.
 */
const LG_DISTANCE_SCALE = { near: 0.85, far: 0.55 } as const;

const isFar = (o: RealObject): boolean => o.realDistance.unit === "Mly";

/**
 * One neighbour's authored polar placement → its LG-tier `DiskPlacement`:
 * centre on the flattened ring around the MW, radius distance-scaled, own
 * tilt/position-angle riding along (via the shared `placementFor` resolution).
 */
export const lgPlacementFor = (o: RealObject): DiskPlacement => {
  const rho = LG_RING.base + LG_RING.gain * o.placement.r;
  const scale = isFar(o) ? LG_DISTANCE_SCALE.far : LG_DISTANCE_SCALE.near;
  const base = placementFor(o); // resolves r = GALAXY_R·size, tilt, pa defaults
  return {
    ...base,
    cx: GALAXY_CENTER.x + Math.cos(o.placement.angle) * rho,
    cy: GALAXY_CENTER.y + Math.sin(o.placement.angle) * rho * LG_FLATTEN,
    r: base.r * scale,
  };
};

/** The 4 placed neighbours of the LG scene — what `GalaxyBackdrop` paints. */
export const lgGalaxies = (): readonly PlacedGalaxy[] =>
  localGroupNeighbours().map((object) => ({
    object,
    place: lgPlacementFor(object),
  }));

/**
 * The reserved Sol/chrome gold (ADR-0010 §4) — the accents below are the ONLY
 * gold at the LG tier and deliberately bypass the theme palette (they must not
 * re-tint with ember/ice/auroral). Pinned to Sol's authored colour by test.
 */
export const LG_GOLD = "#f5d6a0";

/** Globular-cluster sprinkle tuning: a seeded halo annulus around the MW. */
const LG_GLOBULARS = { count: 12, innerR: 0.55, outerR: 1.15, squash: 0.8 };

/**
 * The gold accents of the LG scene: **Sol's amber mark first** (the sun on its
 * arm — the authored MW-interior placement projected through the shrunk LG disk),
 * then the globular-cluster sprinkles scattered on a seeded halo annulus.
 * `BackdropPoint`-shaped so the canvas paints them with the existing `paintGlow`
 * (a dedicated gold sprite). Deterministic + quantized (SSR-safe).
 */
export const lgGoldAccents = (): readonly BackdropPoint[] => {
  const sol = REAL_OBJECTS.find((o) => o.id === SOL_ID);
  const points: BackdropPoint[] = [];
  if (sol) {
    // toStage at pa 0: the disk-polar Sol placement on the shrunk LG MW disk.
    const rr = sol.placement.r * LG_MW_PLACEMENT.r;
    const x = Math.round(
      LG_MW_PLACEMENT.cx + Math.cos(sol.placement.angle) * rr,
    );
    const y = Math.round(
      LG_MW_PLACEMENT.cy +
        Math.sin(sol.placement.angle) * rr * LG_MW_PLACEMENT.tilt,
    );
    // Stacked twice: the additive `lighter` paint doubles up into the one
    // clearly-amber spark on the arm (still "too small to see from here").
    points.push(
      { x, y, size: 2, alpha: 0.95, phase: 0.5, warm: 1 },
      { x, y, size: 1, alpha: 0.85, phase: 0.5, warm: 1 },
    );
  }
  const rng = mulberry32(hashStr("lg-globulars"));
  for (let i = 0; i < LG_GLOBULARS.count; i++) {
    const rho =
      LG_MW_PLACEMENT.r *
      (LG_GLOBULARS.innerR +
        rng() * (LG_GLOBULARS.outerR - LG_GLOBULARS.innerR));
    const theta = rng() * TAU;
    points.push({
      x: Math.round(LG_MW_PLACEMENT.cx + Math.cos(theta) * rho),
      // The halo is spherical, not a disk — only lightly squashed.
      y: Math.round(
        LG_MW_PLACEMENT.cy + Math.sin(theta) * rho * LG_GLOBULARS.squash,
      ),
      size: rng() < 0.3 ? 2 : 1,
      alpha: 0.45 + rng() * 0.3,
      phase: rng(),
      warm: 1,
    });
  }
  return points;
};

/**
 * A hover/focus hit-target over one placed silhouette (#167 hover-only titles):
 * the disk's centre + its projected half-extents (`placedExtent` — the same
 * silhouette bound the fit/label/separation contracts read). The stage renders
 * these as invisible focusable elements that reveal the galaxy's title; #169
 * upgrades the same targets to clickable (MW dive + lore cards).
 */
export type LgHitTarget = {
  id: string;
  loreKey: RealObject["loreKey"];
  /** Disk centre (world px). */
  x: number;
  y: number;
  /** The silhouette's projected half-extents (world px). */
  halfW: number;
  halfH: number;
};

const targetFor = (o: RealObject, place: DiskPlacement): LgHitTarget => {
  const extent = placedExtent(place);
  return {
    id: o.id,
    loreKey: o.loreKey,
    x: place.cx,
    y: place.cy,
    halfW: extent.x,
    halfH: extent.y,
  };
};

/** One hover/focus target per labelled galaxy — the MW + every neighbour. */
export const lgHitTargets = (): readonly LgHitTarget[] => {
  const home = REAL_OBJECTS.find((o) => o.id === HOME_MILKY_WAY_ID);
  return [
    ...(home ? [targetFor(home, LG_MW_PLACEMENT)] : []),
    ...lgGalaxies().map(({ object, place }) => targetFor(object, place)),
  ];
};

/** A label anchor: world coords + which side of the disk the text hangs on. */
export type LgLabel = {
  id: string;
  loreKey: RealObject["loreKey"];
  x: number;
  y: number;
  side: "above" | "below";
};

/** Breathing room between a disk's projected edge and its label (world px). */
const LG_LABEL_GAP = 26;

/**
 * The clumpy recipes' visual mass ends well inside `r` (knot centres stop at
 * `CLUMP_REACH`, the fuzz fades out) — anchor their labels to the *seen* edge,
 * not the geometric bound, or they float (browser pass, I-2).
 */
const CLUMPY_LABEL_EXTENT = 0.72;

const labelExtentY = (o: RealObject, place: DiskPlacement): number => {
  const spiral = o.shape === "barred-spiral" || o.shape === "spiral";
  return placedExtent(place).y * (spiral ? 1 : CLUMPY_LABEL_EXTENT);
};

/**
 * Curated label sides — part of the FINAL-proof composition: the high anchors
 * read above their disks; the MW + SMC sit low and read below. The LMC's label
 * goes ABOVE its cloud (as in the proof) so it clears the bottom-left scale net.
 */
const LG_LABEL_SIDE: Record<string, LgLabel["side"]> = {
  [HOME_MILKY_WAY_ID]: "below",
  andromeda: "above",
  triangulum: "above",
  lmc: "above",
  smc: "below",
};

const labelFor = (o: RealObject, place: DiskPlacement): LgLabel => {
  const side = LG_LABEL_SIDE[o.id] ?? "below";
  const extentY = labelExtentY(o, place);
  return {
    id: o.id,
    loreKey: o.loreKey,
    x: place.cx,
    y:
      side === "above"
        ? place.cy - extentY - LG_LABEL_GAP
        : place.cy + extentY + LG_LABEL_GAP,
    side,
  };
};

/**
 * The serif-name + mono-distance label anchors of the LG scene — the MW + every
 * neighbour, copy resolved downstream from the existing `lore.*` catalog entries
 * (en+ru, no new strings). Rendered as aria-hidden DOM in the camera tree so the
 * labels track the framing exactly like the disks.
 */
export const lgLabels = (): readonly LgLabel[] => {
  const home = REAL_OBJECTS.find((o) => o.id === HOME_MILKY_WAY_ID);
  return [
    ...(home ? [labelFor(home, LG_MW_PLACEMENT)] : []),
    ...lgGalaxies().map(({ object, place }) => labelFor(object, place)),
  ];
};
