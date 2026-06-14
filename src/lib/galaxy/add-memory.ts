/**
 * The write-path orchestrator (ADR-0012 §5, ADR-0013 §3) — the pure, injectable
 * core of "add your star": moderate → classify mood → derive the star → insert.
 *
 * Dependencies (the AI classifier, the D1 insert, the clock, the id generator)
 * are INJECTED so this stays headless-testable: the thin `createServerFn` edge
 * (`src/server/add-star.ts`) wires the real `env.AI` + `drizzle(env.STARS_DB)`,
 * `Date.now()`, and `crypto.randomUUID()` — none of which exist at module scope
 * (SSR-safe, ADR-0003) or in unit tests.
 *
 * Ordering is the contract: moderation runs FIRST, so an empty / flagged
 * submission never reaches the model or D1. The AI sets ONLY `mood`; an
 * unclassifiable response is rejected (a wrong mood is permanent — never guess a
 * default). Every rejection returns a `chat.error.*` key for the visitor.
 */

import { deriveMemoryStar } from "#/lib/galaxy/add-star";
import {
  type ModerationErrorKey,
  moderateMemory,
} from "#/lib/galaxy/moderation";
import type { MemoryStar, Mood } from "#/lib/galaxy/types";

/**
 * The `chat.error.*` catalog keys a rejection maps to. `unclear` = the model
 * could not classify the mood; `failed` = a transport / binding / model failure
 * raised at the server-fn edge (never from this pure orchestrator).
 */
export type AddMemoryErrorKey = ModerationErrorKey | "unclear" | "failed";

export type AddMemoryResult =
  | { ok: true; star: MemoryStar }
  | { ok: false; errorKey: AddMemoryErrorKey };

export type AddMemoryDeps = {
  /** Workers-AI classifier → one `Mood`, or `null` if unclassifiable. */
  detectMood: (description: string) => Promise<Mood | null>;
  /** Persist the derived star (Drizzle insert); returns it for the live sky. */
  insert: (star: MemoryStar) => Promise<MemoryStar>;
  /** Insert-time clock (request scope, never module scope). */
  now: () => number;
  /** Stable, deep-linkable id generator. */
  newId: () => string;
};

export const addMemory = async (
  input: string,
  deps: AddMemoryDeps,
): Promise<AddMemoryResult> => {
  // 1. Moderation gate — BEFORE the model and D1 (a flagged/empty input never
  //    reaches either).
  const moderation = moderateMemory(input);
  if (!moderation.ok) return { ok: false, errorKey: moderation.errorKey };

  // 2. Mood classification — the ONLY AI-provided field.
  const mood = await deps.detectMood(moderation.text);
  if (mood === null) return { ok: false, errorKey: "unclear" };

  // 3. Derive every render/identity field from the handler (never AI-controlled).
  const star = deriveMemoryStar({
    id: deps.newId(),
    text: moderation.text,
    mood,
    createdAt: deps.now(),
  });

  // 4. Persist + return for ignition.
  const saved = await deps.insert(star);
  return { ok: true, star: saved };
};
