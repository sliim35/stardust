/**
 * Pure derivation of a new `MemoryStar` from the ONE AI-provided field (`mood`)
 * plus the handler-supplied `id` / `text` / `createdAt` (ADR-0012 §5, ADR-0013 §3).
 *
 * The AI sets ONLY `mood`. Everything the renderer needs is derived here, never
 * AI-controlled:
 * - `color = MOODS[mood].color`
 * - `{ r, angle } = placeStar(id, mood)` — the append-only placement (same id →
 *   same coords forever, so adding a star never moves the others).
 * - `brightness` — deterministic per id (same `mulberry32(hashStr(id) ^ …)` seed
 *   as `buildSeedSky`), capped below 1 so Mom's gold star stays the unique max
 *   (#146); pure of the clock, so SSR + client agree (ADR-0003).
 *
 * `egg` / `deep` / `placement` are authored-only — they are never produced here,
 * so the AI path can never mint an egg/deep/explicitly-placed star.
 *
 * Kept pure + transport-free so it's headless-testable; the AI call, moderation,
 * and the Drizzle insert all live at the server-fn edge.
 */

import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import { MOODS, placeStar } from "#/lib/galaxy/seed";
import type { MemoryStar, Mood } from "#/lib/galaxy/types";

export type DeriveStarInput = {
  /** Handler-derived stable, deep-linkable id (never AI-controlled). */
  id: string;
  /** The user's own memory text — already moderated + trimmed (never AI-rewritten). */
  text: string;
  /** The ONE AI-provided field — the classified mood. */
  mood: Mood;
  /** Caller-supplied at insert time (request scope, never Date.now() at module scope). */
  createdAt: number;
};

export const deriveMemoryStar = (input: DeriveStarInput): MemoryStar => {
  const { id, text, mood, createdAt } = input;
  const { r, angle } = placeStar(id, mood);
  // Same id-seeded stream as buildSeedSky; capped < 1 so Mom's star is unique-max.
  const rng = mulberry32(hashStr(id) ^ 0x9e3779b9);
  const brightness = 0.55 + rng() * 0.4;

  return {
    id,
    text,
    mood,
    color: MOODS[mood].color,
    r,
    angle,
    brightness,
    createdAt,
  };
};
