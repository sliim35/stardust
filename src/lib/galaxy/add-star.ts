/**
 * Pure derivation of a new `MemoryStar` from the AI-provided fields (`mood` +
 * the optional `trigger`) plus the handler-supplied `id` / `text` / `createdAt`
 * (ADR-0012 §5, ADR-0013 §3, ADR-0014 §3/§4).
 *
 * The AI sets ONLY `mood` + `trigger`. Everything the renderer needs is derived
 * here, never AI-controlled:
 * - `color = MOODS[mood].color`
 * - `{ r, angle } = placeStar(id, mood)` — the append-only placement (same id →
 *   same coords forever, so adding a star never moves the others).
 * - `brightness` — deterministic per id (same `mulberry32(hashStr(id) ^ …)` seed
 *   as `buildSeedSky`), capped below 1 so Mom's gold star stays the unique max
 *   (#146); pure of the clock, so SSR + client agree (ADR-0003).
 * - `placement` — routes the star to its emotion's host galaxy
 *   (`parentId = hostGalaxyFor(mood)`, tier `galaxy`), so a new memory lands in
 *   the correct Local-Group galaxy on the *write* path, not by the read-fallback
 *   accident (#219, ADR-0014 §3). `(r, angle)` mirror the star's own coords.
 * - `group` — the figure-membership key, one per emotion (the emotion literal
 *   itself); same-emotion stars cohere into one designed figure. The anchor snap
 *   onto a designed silhouette is deferred to the figure-placement story (BR30 —
 *   the geometry isn't authored yet), so `(r, angle)` stay the `placeStar` wedge.
 *
 * `egg` / `deep` are authored-only — never produced here, so the AI path can
 * never mint an egg/deep star.
 *
 * Kept pure + transport-free so it's headless-testable; the AI call, moderation,
 * and the Drizzle insert all live at the server-fn edge.
 */

import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import { hostGalaxyFor, MOODS, placeStar } from "#/lib/galaxy/seed";
import type { MemoryStar, Mood, Trigger } from "#/lib/galaxy/types";

export type DeriveStarInput = {
  /** Handler-derived stable, deep-linkable id (never AI-controlled). */
  id: string;
  /** The user's own memory text — already moderated + trimmed (never AI-rewritten). */
  text: string;
  /** The classified mood — drives colour, placement (host galaxy), and figure group. */
  mood: Mood;
  /** Caller-supplied at insert time (request scope, never Date.now() at module scope). */
  createdAt: number;
  /** What sparked the memory (BR28) — captured from the chat extraction; omitted = absent. */
  trigger?: Trigger;
};

export const deriveMemoryStar = (input: DeriveStarInput): MemoryStar => {
  const { id, text, mood, createdAt, trigger } = input;
  const { r, angle } = placeStar(id, mood);
  // Same id-seeded stream as buildSeedSky; capped < 1 so Mom's star is unique-max.
  const rng = mulberry32(hashStr(id) ^ 0x9e3779b9);
  const brightness = 0.55 + rng() * 0.4;

  const star: MemoryStar = {
    id,
    text,
    mood,
    color: MOODS[mood].color,
    r,
    angle,
    brightness,
    createdAt,
    // One figure-group key per emotion — same-emotion stars share a figure.
    group: mood,
    // Route to the emotion's host galaxy; coords mirror the star's own (r, angle).
    placement: { tier: "galaxy", parentId: hostGalaxyFor(mood), r, angle },
  };

  // Only attach `trigger` when captured — absent stays absent (back-compat).
  if (trigger !== undefined) star.trigger = trigger;
  return star;
};
