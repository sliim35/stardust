/**
 * Pure row → `MemoryStar` mapper (ADR-0012 §3). The D1 read returns flat
 * `memory_stars` rows with NULLable optional columns; the renderer + store expect
 * the existing optional-field shape where an absent field is *missing*, not `null`.
 *
 * Rules:
 * - `grp` → `group`.
 * - `trigger` (BR28) passes straight through; NULL → absent (back-compat).
 * - the `tier` / `parent_id` / `placement_r` / `placement_angle` quartet folds
 *   into `placement?` — present when the position pair is non-NULL (all-or-none),
 *   with `parentId` itself optional (absent at the local group). When the WHOLE
 *   quartet is NULL (a pre-migration / legacy row), the mapper synthesizes a
 *   galaxy-tier placement routed by emotion — `parentId: hostGalaxyFor(mood)`,
 *   mirroring the star's own `(r, angle)` — so legacy rows land in the correct
 *   galaxy instead of being forced to `home` by the renderer's old hardcoded
 *   default (ADR-0014 §3, BR26; issue #210 AC3). A *partially*-NULL quartet
 *   (corrupt data atomic writes shouldn't produce) is NOT synthesized — `placement`
 *   stays ABSENT so the corruption isn't silently masked by intrinsic coords.
 * - every other NULL column → the field is ABSENT (never `null`).
 * - `egg` / `deep` are never set (no user star is an egg/deep star — not columns).
 *
 * Kept pure + transport-free so it's headless-testable; the async D1 read that
 * feeds it lives at the loader / server-fn edge.
 */

import type { memoryStars } from "#/lib/galaxy/schema";
import { hostGalaxyFor } from "#/lib/galaxy/seed";
import type { MemoryStar, Placement, Tier } from "#/lib/galaxy/types";

/** A selected `memory_stars` row — inferred from the schema (single source). */
export type MemoryStarRow = typeof memoryStars.$inferSelect;

export const rowToMemoryStar = (row: MemoryStarRow): MemoryStar => {
  const star: MemoryStar = {
    id: row.id,
    text: row.text,
    mood: row.mood,
    color: row.color,
    r: row.r,
    angle: row.angle,
    brightness: row.brightness,
    createdAt: row.createdAt,
  };

  if (row.name !== null) star.name = row.name;
  if (row.grp !== null) star.group = row.grp;
  if (row.who !== null) star.who = row.who;
  if (row.trigger !== null) star.trigger = row.trigger;

  // The placement quartet is all-or-none; presence is keyed on the position pair
  // (tier + the two coords), with parentId itself optional (absent at local group).
  if (
    row.tier !== null &&
    row.placementR !== null &&
    row.placementAngle !== null
  ) {
    const placement: Placement = {
      tier: row.tier as Tier,
      r: row.placementR,
      angle: row.placementAngle,
    };
    if (row.parentId !== null) placement.parentId = row.parentId;
    star.placement = placement;
  } else if (
    // Genuine pre-migration row: the WHOLE quartet is NULL. Only then synthesize
    // a galaxy-tier placement routed by emotion, mirroring the star's own polar
    // coords — so pre-#193 rows land in the right galaxy's tier-2 view instead of
    // the renderer's hardcoded `home` default (AC3, ADR-0014 §3).
    //
    // A *partially*-NULL quartet (e.g. tier NULL but a coord present) is corrupt
    // data that atomic writes shouldn't produce; we deliberately fall through and
    // leave placement ABSENT rather than synthesize from intrinsic coords, so the
    // corruption is never silently masked.
    row.tier === null &&
    row.parentId === null &&
    row.placementR === null &&
    row.placementAngle === null
  ) {
    star.placement = {
      tier: "galaxy",
      parentId: hostGalaxyFor(row.mood),
      r: row.r,
      angle: row.angle,
    };
  }

  return star;
};
