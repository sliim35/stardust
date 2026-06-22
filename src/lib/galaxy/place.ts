/**
 * Stage geometry for the Memory Galaxy renderer (#4). The numbers are *locked*
 * from the prototype (`docs/design/2026-06-02-explorable-galaxy.md` §"Geometry
 * constants") so the disk, the deep-space features, and the memory stars all
 * agree on one coordinate space.
 *
 * A star's screen position is a pure function of its own `(r, angle)` plus the view's
 * disk `tilt` — a uniform display parameter, not a per-star value (#234) — never of
 * where it sits in the array. That is what makes the renderer's append-only invariant
 * hold: for a fixed view, adding a star can never move an existing one (same inputs →
 * same position; #4 AC, mirrors the #2 store seam).
 */

/** The fixed logical stage; the scene letterboxes (`contain`) into any viewport. */
export const STAGE_W = 1280;
export const STAGE_H = 800;

/** Disk center, placement radius, and the foreshortening of the tilted disk. */
export const GALAXY_CENTER = { x: 640, y: 400 } as const;
export const GALAXY_R = 360;
export const DISK_TILT = 0.74;

/** Reserved marker positions (the cinematic targets live in #5+). */
export const SOL_POS = { x: 760, y: 440 } as const;
export const EARTH_POS = { x: 640, y: 400 } as const;

export type Point = { x: number; y: number };

/**
 * Polar memory coordinates → stage pixels: `r` is 0..1 from center, `angle` radians;
 * the y axis is foreshortened by `tilt` (defaults to the home `DISK_TILT`; a neighbour
 * passes its own so its figures/stars sit on its tilted disk, not the global 0.74 — #234).
 */
export const polarToXY = (
  r: number,
  angle: number,
  tilt: number = DISK_TILT,
): Point => ({
  x: GALAXY_CENTER.x + Math.cos(angle) * r * GALAXY_R,
  y: GALAXY_CENTER.y + Math.sin(angle) * r * GALAXY_R * tilt,
});

/** A star (or anything) carrying its own polar placement. */
type Placeable = { id: string; r: number; angle: number };

/**
 * Resolve a list of placeables to an `id → {x, y}` map at the view `tilt`. A given
 * id's position depends only on its own `(r, angle)` plus the uniform `tilt`, so it
 * is stable no matter what else is in the list (the append-only invariant).
 */
export const layoutStars = (
  items: readonly Placeable[],
  tilt: number = DISK_TILT,
): Record<string, Point> => {
  const out: Record<string, Point> = {};
  for (const it of items) out[it.id] = polarToXY(it.r, it.angle, tilt);
  return out;
};
