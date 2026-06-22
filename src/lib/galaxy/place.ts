/**
 * Stage geometry for the Memory Galaxy renderer (#4). The numbers are *locked*
 * from the prototype (`docs/design/2026-06-02-explorable-galaxy.md` §"Geometry
 * constants") so the disk, the deep-space features, and the memory stars all
 * agree on one coordinate space.
 *
 * Everything here is a pure function of a star's own `(r, angle)`. That is what
 * makes the renderer's append-only invariant hold: a star's screen position is
 * derived from its own data, never from where it sits in the array — so adding a
 * star can never move an existing one (#4 AC, mirrors the #2 store seam).
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
 * Polar memory coordinates → stage pixels. `r` is 0..1 from center, `angle` is
 * radians; the y axis is foreshortened by `tilt` so the disk reads as tilted away
 * from the viewer. `tilt` defaults to the home MW's `DISK_TILT`; a neighbour galaxy
 * passes its own interior tilt (M31 0.42 · M33 0.9) so its figures + member stars —
 * authored inverted with that tilt — project onto its own foreshortened disk instead
 * of the global 0.74, which would land them off-screen / squashed (#234).
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
 * Resolve a list of placeables to an `id → {x, y}` map. Each position depends
 * only on that item's own `(r, angle)`, so the result for a given id is stable
 * no matter what else is in the list (the append-only invariant).
 */
export const layoutStars = (
  items: readonly Placeable[],
  tilt: number = DISK_TILT,
): Record<string, Point> => {
  const out: Record<string, Point> = {};
  for (const it of items) out[it.id] = polarToXY(it.r, it.angle, tilt);
  return out;
};
