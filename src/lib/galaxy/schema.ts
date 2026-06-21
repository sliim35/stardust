/**
 * The Drizzle `memory_stars` table — the durable store for **user** Memory Stars
 * (ADR-0012 §3, owner schema spec on #163). Seeded fixtures (`irina`, the seed
 * corpus) are NEVER inserted; they are merged in at store-construction time from
 * `buildSeedSky()` (`store-d1.ts`). The seed-only flags `egg`/`deep` are therefore
 * deliberately NOT columns — no user star is an egg/deep star.
 *
 * `grp` renames `MemoryStar.group` (`group` is a SQL reserved word). `trigger`
 * (BR28) is nullable — NULL = absent. The `tier`/`parent_id`/`placement_r`/
 * `placement_angle` quartet is the optional `Placement` (all-or-none; a NULL
 * quartet routes via `hostGalaxyFor(mood)` in the mapper, not always `home`).
 * The row → `MemoryStar` mapper lives in `star-mapper.ts`.
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
import type { Trigger } from "#/lib/galaxy/types";

/**
 * The two `Trigger` literals (BR28, ADR-0014 §4) — what sparked a memory. Listed
 * `as const satisfies readonly Trigger[]` so the Drizzle `{ enum }` stays
 * compile-locked to `types.ts:Trigger`; adding/removing a literal there fails this
 * to type-check. Like `EMOTION_VALUES`, this is a TS guard only — SQLite TEXT
 * stores no enum constraint, so the column is a plain nullable `TEXT`.
 */
export const TRIGGER_VALUES = [
  "person",
  "action",
] as const satisfies readonly Trigger[];

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
    // What sparked this memory (BR28, ADR-0014 §4) — `person | action`. Nullable,
    // no default: NULL = absent (back-compat with seeded stars + pre-migration
    // rows). Like `mood`, the union is enforced in TS via Drizzle `{ enum }` (not a
    // DB CHECK — SQLite TEXT stores no constraint), so the row→`MemoryStar` map
    // assigns `Trigger | null` without a cast (ADR-0012 amendment 2026-06-14).
    trigger: text("trigger", { enum: TRIGGER_VALUES }),
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
