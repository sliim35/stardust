/**
 * The write-path orchestrator (ADR-0012 §5, ADR-0013 §3, ADR-0014 §3) — the pure,
 * injectable core of "add your star", split into TWO confirm-first steps:
 *
 *   1. `proposeMemory` — moderate → classify emotion + trigger → derive the routed
 *      star → **return it WITHOUT persisting**, surfacing its host galaxy id. This is
 *      the owner-ratified safety net (#219, BR-add-star): the user sees WHERE a
 *      memory will go (the classified emotion + target galaxy) before committing,
 *      so a 12-way-on-llama-8b misroute is caught before it becomes permanent.
 *   2. `commitMemory` — insert the **confirmed** star and return the saved row for
 *      the live sky.
 *
 * Dependencies (the AI classifiers, the D1 insert, the clock, the id generator)
 * are INJECTED so this stays headless-testable: the thin `createServerFn` edge
 * (`src/server/add-star.ts`) wires the real `env.AI` + `drizzle(env.STARS_DB)`,
 * `Date.now()`, and `crypto.randomUUID()` — none of which exist at module scope
 * (SSR-safe, ADR-0003) or in unit tests.
 *
 * Ordering is the contract: moderation runs FIRST, so an empty / flagged
 * submission never reaches the model or D1. The AI sets ONLY `mood` + `trigger`;
 * an unclassifiable *mood* is rejected (a wrong galaxy is permanent — never guess
 * a default), but an unclassifiable *trigger* is non-fatal (the chip is metadata,
 * absent = no chip). Every rejection returns a `chat.error.*` key for the visitor.
 */

import { deriveMemoryStar } from "#/lib/galaxy/add-star";
import { placeOnFigure } from "#/lib/galaxy/constellation";
import {
  type ModerationErrorKey,
  moderateMemory,
} from "#/lib/galaxy/moderation";
import { hostGalaxyFor, isMood } from "#/lib/galaxy/seed";
import { isTrigger } from "#/lib/galaxy/trigger-detect";
import type {
  ConstellationFigure,
  MemoryStar,
  Mood,
  Trigger,
} from "#/lib/galaxy/types";

/**
 * The `chat.error.*` catalog keys a rejection maps to. `unclear` = the model
 * could not classify the mood; `failed` = a transport / binding / model failure
 * raised at the server-fn edge (never from this pure orchestrator).
 */
export type AddMemoryErrorKey = ModerationErrorKey | "unclear" | "failed";

/**
 * A classified, routed-but-NOT-persisted star plus the host galaxy id the
 * confirm-first UX names (#219 AC2). `star.placement.parentId === hostGalaxyId`
 * by construction; the id is returned at the top level so the UI need not reach
 * into `placement` to render the routing prompt.
 */
export type ProposeMemoryResult =
  | { ok: true; star: MemoryStar; hostGalaxyId: string }
  | { ok: false; errorKey: AddMemoryErrorKey };

export type CommitMemoryResult =
  | { ok: true; star: MemoryStar }
  | { ok: false; errorKey: AddMemoryErrorKey };

export type ProposeMemoryDeps = {
  /** Workers-AI emotion classifier → one `Mood`, or `null` if unclassifiable. */
  detectMood: (description: string) => Promise<Mood | null>;
  /** Workers-AI trigger classifier → `person | action`, or `null` (non-fatal). */
  detectTrigger: (description: string) => Promise<Trigger | null>;
  /** Insert-time clock (request scope, never module scope). */
  now: () => number;
  /** Stable, deep-linkable id generator. */
  newId: () => string;
};

export type CommitMemoryDeps = {
  /** Persist the confirmed star (Drizzle insert); returns it for the live sky. */
  insert: (star: MemoryStar) => Promise<MemoryStar>;
  /**
   * Resolve a star's `group` to its authored figure, or `null` for none (#222).
   * Optional — absent (or `null`) keeps the `placeStar` wedge, which is today's
   * production behaviour (`CONSTELLATIONS` is empty until silhouettes are authored).
   */
  figureFor?: (group: string) => ConstellationFigure | null;
  /**
   * The figure's EXISTING members (for the anchor rank), excluding the new star
   * (#222). Required only alongside `figureFor`; the new star's slot is its rank
   * among these + itself, so append-only never moves an earlier member. Async so
   * the real edge can read same-group rows from D1 (reached only when a figure
   * exists — never in production today, `CONSTELLATIONS` empty).
   */
  groupMembers?: (group: string) => Promise<readonly MemoryStar[]>;
};

/**
 * Step 1 — classify + route, NO persist. Moderates first, then classifies the
 * emotion (required) and the trigger (optional), then derives the fully-routed
 * star. The caller surfaces `hostGalaxyId` + the emotion in the confirm prompt.
 */
export const proposeMemory = async (
  input: string,
  deps: ProposeMemoryDeps,
): Promise<ProposeMemoryResult> => {
  // 1. Moderation gate — BEFORE the model (a flagged/empty input never reaches it).
  const moderation = moderateMemory(input);
  if (!moderation.ok) return { ok: false, errorKey: moderation.errorKey };

  // 2. Emotion classification — required; a wrong galaxy is permanent, so an
  //    unclassifiable mood is rejected rather than defaulted.
  const mood = await deps.detectMood(moderation.text);
  if (mood === null) return { ok: false, errorKey: "unclear" };

  // 3. Trigger classification — optional metadata (BR28); `null` → no chip.
  const trigger = await deps.detectTrigger(moderation.text);

  // 4. Derive every render/identity/routing field from the handler (never AI).
  const star = deriveMemoryStar({
    id: deps.newId(),
    text: moderation.text,
    mood,
    createdAt: deps.now(),
    ...(trigger !== null ? { trigger } : {}),
  });

  // The host galaxy is derived from the emotion (single source); echo it for the UI.
  return { ok: true, star, hostGalaxyId: hostGalaxyFor(mood) };
};

/** Step 2 — persist the confirmed star. SECURITY (#221): reachable directly, so the client `star` is UNTRUSTED — re-moderate, re-validate `mood`, re-derive every field server-side. */
export const commitMemory = async (
  star: MemoryStar,
  deps: CommitMemoryDeps,
): Promise<CommitMemoryResult> => {
  // Re-run the moderation gate — an unmoderated/flagged direct commit is rejected.
  const moderation = moderateMemory(star.text);
  if (!moderation.ok) return { ok: false, errorKey: moderation.errorKey };

  // Re-validate the emotion — a forged/out-of-enum mood routes nowhere safe.
  if (!isMood(star.mood)) return { ok: false, errorKey: "unclear" };

  // Re-derive from trusted fields only; an out-of-enum trigger is dropped.
  const derived = deriveMemoryStar({
    id: star.id,
    text: moderation.text,
    mood: star.mood,
    createdAt: star.createdAt,
    ...(isTrigger(star.trigger) ? { trigger: star.trigger } : {}),
  });

  // Anchor placement at write (#222, BR24/BR27): if the star's group has an authored
  // figure, snap it to its next open anchor (append-only); else keep the placeStar
  // wedge `deriveMemoryStar` already set. Production is the wedge (CONSTELLATIONS empty).
  const placed = await placeOnAnchor(derived, deps);

  const saved = await deps.insert(placed);
  return { ok: true, star: saved };
};

/**
 * Apply the append-only anchor placement to a derived star (#222): when a figure
 * exists for its `group` and `placeOnFigure` binds it, overwrite the star's
 * `(r, angle)` + `placement.{r,angle}` with the anchor slot; otherwise the
 * `placeStar` wedge stands. The host galaxy routing (`placement.parentId/tier`) is
 * untouched. Existing members are read ONLY when a figure exists. Returns a NEW star.
 */
const placeOnAnchor = async (
  star: MemoryStar,
  deps: CommitMemoryDeps,
): Promise<MemoryStar> => {
  if (!deps.figureFor || !deps.groupMembers || star.group === undefined) {
    return star;
  }
  const figure = deps.figureFor(star.group);
  if (figure === null) return star; // no silhouette → the placeStar wedge stands
  const members = await deps.groupMembers(star.group);
  const slot = placeOnFigure(star, members, figure);
  if (slot === null) return star; // deep / cross-emotion → never anchored
  return {
    ...star,
    r: slot.r,
    angle: slot.angle,
    // Keep placement.parentId/tier (routing); only the coords follow the anchor.
    ...(star.placement
      ? { placement: { ...star.placement, r: slot.r, angle: slot.angle } }
      : {}),
  };
};
