/**
 * The Drizzle `memory_stars` table — the durable store for **user** Memory Stars
 * (ADR-0012 §3, owner schema spec on #163). Seeded fixtures (`irina`, the seed
 * corpus) are NEVER inserted; they are merged in at store-construction time from
 * `buildSeedSky()` (`store-d1.ts`). The seed-only flags `egg`/`deep` are therefore
 * deliberately NOT columns — no user star is an egg/deep star.
 *
 * `grp` renames `MemoryStar.group` (`group` is a SQL reserved word). The
 * `tier`/`parent_id`/`placement_r`/`placement_angle` quartet is the optional
 * `Placement` (all-or-none; a NULL quartet = the renderer's legacy home-galaxy
 * default). The row → `MemoryStar` mapper lives in `star-mapper.ts`.
 *
 * This module is the single source of truth that BOTH the per-request query
 * (`store-d1` loader / `add-star` server fn) and `drizzle-kit generate` consume —
 * never construct a `drizzle()` connection here (per-request only, ADR-0003).
 */

import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { EMOTION_VALUES } from "#/lib/galaxy/seed";

export const memoryStars = sqliteTable(
  "memory_stars",
  {
    id: text("id").primaryKey(),
    text: text("text").notNull(),
    name: text("name"),
    // The 12 Emotion literals — enforced in TS (Drizzle `{ enum }`), not a DB CHECK.
    // `EMOTION_VALUES` is the single source shared with the AI classifier + `Emotion`.
    // Widening 7→12 is type-only: SQLite TEXT has no stored enum constraint, so the
    // generated migration is a no-op (existing rows with old mood values stay valid).
    mood: text("mood", { enum: EMOTION_VALUES }).notNull(),
    color: text("color").notNull(),
    r: real("r").notNull(),
    angle: real("angle").notNull(),
    brightness: real("brightness").notNull(),
    grp: text("grp"),
    who: text("who"),
    tier: text("tier"),
    parentId: text("parent_id"),
    placementR: real("placement_r"),
    placementAngle: real("placement_angle"),
    // epoch ms — caller-supplied at insert (never Date.now() at module scope).
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_memory_stars_created_at").on(t.createdAt),
    index("idx_memory_stars_grp").on(t.grp),
  ],
);
