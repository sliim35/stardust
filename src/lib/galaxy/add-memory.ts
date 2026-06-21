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
import {
  type ModerationErrorKey,
  moderateMemory,
} from "#/lib/galaxy/moderation";
import { TRIGGER_VALUES } from "#/lib/galaxy/schema";
import { hostGalaxyFor, isMood } from "#/lib/galaxy/seed";
import type { MemoryStar, Mood, Trigger } from "#/lib/galaxy/types";

/** Runtime guard for the committed trigger — anything else is dropped. */
const isTrigger = (value: unknown): value is Trigger =>
  (TRIGGER_VALUES as readonly string[]).includes(value as string);

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

/**
 * Step 2 — persist the confirmed proposal + return it for ignition.
 *
 * SECURITY (#221): the commit endpoint is reachable directly (a caller can skip
 * `proposeMemory` and POST any payload), so it must NOT trust the client `star`.
 * It re-runs moderation on `text`, re-validates `mood`, and **re-derives** every
 * render/identity/routing field server-side via `deriveMemoryStar` — so a forged
 * colour / placement / group / brightness / `egg` / `deep` is discarded and an
 * unmoderated or out-of-enum payload can never be persisted as-is.
 */
export const commitMemory = async (
  star: MemoryStar,
  deps: CommitMemoryDeps,
): Promise<CommitMemoryResult> => {
  // Re-run the moderation gate — an unmoderated/flagged direct commit is rejected.
  const moderation = moderateMemory(star.text);
  if (!moderation.ok) return { ok: false, errorKey: moderation.errorKey };

  // Re-validate the emotion — a forged/out-of-enum mood routes nowhere safe.
  if (!isMood(star.mood)) return { ok: false, errorKey: "unclear" };

  // Re-derive from the TRUSTED fields only; a re-validated trigger is the sole
  // client-carried metadata (anything out-of-enum is dropped, never persisted).
  const derived = deriveMemoryStar({
    id: star.id,
    text: moderation.text,
    mood: star.mood,
    createdAt: star.createdAt,
    ...(isTrigger(star.trigger) ? { trigger: star.trigger } : {}),
  });

  const saved = await deps.insert(derived);
  return { ok: true, star: saved };
};
