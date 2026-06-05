/**
 * Pure visual math for a Layer-A real object (ADR-0010 §4, #146) — the headless
 * half of `GalaxyFeatureLayer`, mirroring how `star-visual.ts` is the headless
 * half of `MemoryStarView`. Every rule that maps a `RealObject`'s `shape`/`kind`
 * → an **HD-2D soft-glow** draw primitive lives here so it is unit-testable in
 * node (no canvas, no React).
 *
 * The aesthetic is owner-binding (memory `pixel-art-always`, the design spec): the
 * COSMOS — galaxies, nebulae, Sol — is **sleek soft glow** (smooth radial blooms,
 * no hard pixels); only ASTRO stays crisp pixel art. So every primitive here is a
 * soft, additive glow shape; the renderer paints them with radial gradients +
 * `lighter` compositing (like `GalaxyBackdrop`), never a 1px grid.
 *
 * The seam is the same as the rest of the renderer: the data owns position
 * (`placement`), colour (`color`), morphology (`shape` + `arms`/`barAngle`/`tilt`),
 * size and brightness — this module never recolours or repositions, it only
 * *projects* those fields into draw parameters. Pure → SSR/Workers-safe.
 */

import { type Point, polarToXY } from "#/lib/galaxy/place";
import { HOME_MILKY_WAY_ID, realObjectsForView } from "#/lib/galaxy/realdata";
import type { RealObject, RealShape } from "#/lib/galaxy/types";

/** Which soft-glow primitive the renderer paints for an object. */
export type RealPrimitive =
  | "disk" // a galaxy — soft elliptical disk glow (tilt + bar cues)
  | "cloud" // a nebula — soft irregular puff
  | "point" // a star (Sol) — bright glowing point + flare
  | "ring" // a marker (Sgr A*) — a faint core ring
  | "none"; // an arm label — no canvas mark; a DOM label only

/**
 * The draw spec for one real object: the primitive + the soft-glow parameters the
 * canvas renderer consumes. `radiusPx` is the silhouette's base glow radius on the
 * 1280×800 stage; `aspect` squashes it vertically (1 = round, <1 = lopsided/streaky
 * — the morphology ladder spiral→irregular reads flatter); `tilt`/`barAngle` orient
 * the disk; `alpha` is the peak glow opacity; `color` is passed through verbatim.
 */
export type RealDrawSpec = {
  primitive: RealPrimitive;
  radiusPx: number;
  aspect: number; // vertical squash, 0..1
  tilt: number; // radians — disk inclination
  barAngle: number; // radians — bar orientation (0 if none)
  alpha: number; // 0..1 peak glow alpha
  color: string;
};

/** Stage pixels for a real object — the same polar convention as memory stars. */
export const realScreenPos = (obj: RealObject): Point =>
  polarToXY(obj.placement.r, obj.placement.angle);

/** Which canvas primitive a shape paints (spec §5.1a morphology → silhouette). */
const PRIMITIVE_FOR_SHAPE = {
  "barred-spiral": "disk",
  spiral: "disk",
  magellanic: "disk",
  irregular: "disk",
  "dwarf-spheroidal": "disk",
  nebula: "cloud",
  star: "point",
  marker: "ring",
} as const satisfies Record<RealShape, RealPrimitive>;

/**
 * Vertical squash per shape — the morphology depth/structure cue (spec §5.1a):
 * structured spirals read as elegant tilted ellipses; the Magellanic/irregular/
 * dwarf shapes read flatter, streakier, lopsided. Non-disk primitives are round.
 */
const ASPECT_FOR_SHAPE = {
  "barred-spiral": 0.62,
  spiral: 0.66,
  magellanic: 0.5,
  irregular: 0.42,
  "dwarf-spheroidal": 0.72,
  nebula: 0.82,
  star: 1,
  marker: 1,
} as const satisfies Record<RealShape, number>;

/** Base glow radius on the stage; scaled by the object's `size` (0..1). */
const BASE_RADIUS_PX = 110;

/**
 * Project a real object → its soft-glow draw spec. Pure: every value derives from
 * the object's own data, so the same object always draws the same way (SSR-safe).
 */
export const realDrawSpec = (obj: RealObject): RealDrawSpec => ({
  primitive: obj.kind === "armLabel" ? "none" : PRIMITIVE_FOR_SHAPE[obj.shape],
  // A floor so even a tiny dwarf still reads; size scales it up from there.
  radiusPx: 14 + BASE_RADIUS_PX * obj.size,
  aspect: ASPECT_FOR_SHAPE[obj.shape],
  tilt: obj.tilt ?? 0,
  barAngle: obj.barAngle ?? 0,
  // Keep the cosmos dim + reverent (design spec): brightness drives a sub-unity
  // peak alpha so nothing blows out the soft-glow field.
  alpha: 0.25 + obj.brightness * 0.5,
  color: obj.color,
});

/**
 * The real objects the **home Milky-Way tier** renders (#146 v1): the interior set
 * parented to `home` — Sgr A*, the Orion Arm, Sol, and the 3 named nebulae. The
 * Milky-Way galaxy itself is the disk backdrop (`GalaxyBackdrop`), not a feature;
 * the Local-Group neighbours belong to the wider tier (a later slice). Reads the
 * Wave-1 selector — the single data seam — so the view never re-lists ids.
 */
export const homeViewObjects = (): readonly RealObject[] =>
  realObjectsForView("galaxy", HOME_MILKY_WAY_ID);
