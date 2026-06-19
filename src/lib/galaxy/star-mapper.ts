/**
 * Pure row → `MemoryStar` mapper (ADR-0012 §3). The D1 read returns flat
 * `memory_stars` rows with NULLable optional columns; the renderer + store expect
 * the existing optional-field shape where an absent field is *missing*, not `null`.
 *
 * Rules:
 * - `grp` → `group`.
 * - the `tier` / `parent_id` / `placement_r` / `placement_angle` quartet folds
 *   into `placement?` — present only when the position pair is non-NULL
 *   (all-or-none); a NULL quartet leaves `placement` absent (the renderer's legacy
 *   home-galaxy default). `parentId` is itself optional (absent at the local group).
 * - every NULL column → the field is ABSENT (never `null`).
 * - `egg` / `deep` are never set (no user star is an egg/deep star — not columns).
 *
 * Kept pure + transport-free so it's headless-testable; the async D1 read that
 * feeds it lives at the loader / server-fn edge.
 */

import type { memoryStars } from "#/lib/galaxy/schema";
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
  }

  return star;
};
