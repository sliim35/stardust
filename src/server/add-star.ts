/**
 * The "add your star" write-path server fns (ADR-0012 §5, ADR-0013 §1/§3,
 * ADR-0014 §3/§4) — the thin Cloudflare-Workers edge around the pure
 * propose/commit orchestrator, split confirm-first (#219):
 *
 *   - `proposeStarFn` — moderate → classify emotion + trigger → derive the routed
 *     star → return it WITHOUT touching D1, so the UI can name the target galaxy
 *     and let the user confirm before anything is persisted.
 *   - `commitStarFn` — insert the confirmed star into D1 and return it for the sky.
 *
 * SSR-safe (ADR-0003): `env`, `drizzle(env.STARS_DB)`, `env.AI`, `Date.now()`,
 * and `crypto.randomUUID()` are all touched INSIDE a handler (request scope) —
 * never at module scope. The pure logic (moderation, classification parsing,
 * field derivation, routing) lives in `#/lib/galaxy/*` and is unit-tested without
 * bindings; this file only wires the real bindings to the injected deps.
 */

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import {
  type CommitMemoryResult,
  commitMemory,
  type ProposeMemoryResult,
  proposeMemory,
} from "#/lib/galaxy/add-memory";
import {
  buildMoodMessages,
  MOOD_JSON_SCHEMA,
  MOOD_MODEL,
  parseMoodResponse,
} from "#/lib/galaxy/mood-detect";
import { memoryStars } from "#/lib/galaxy/schema";
import {
  buildTriggerMessages,
  parseTriggerResponse,
  TRIGGER_JSON_SCHEMA,
  TRIGGER_MODEL,
} from "#/lib/galaxy/trigger-detect";
import type { MemoryStar, Mood, Trigger } from "#/lib/galaxy/types";

/** Validate the raw client input into a string (defensive; moderation re-trims). */
const validateInput = (raw: unknown): string =>
  typeof raw === "string" ? raw : "";

/** Workers-AI emotion classification via the per-request `env.AI` binding. */
const detectMood = async (description: string): Promise<Mood | null> => {
  const response = await env.AI.run(MOOD_MODEL, {
    messages: buildMoodMessages(description),
    response_format: MOOD_JSON_SCHEMA,
  });
  return parseMoodResponse(response);
};

/** Workers-AI trigger classification (BR28) — `person | action`, or `null` (no chip). */
const detectTrigger = async (description: string): Promise<Trigger | null> => {
  const response = await env.AI.run(TRIGGER_MODEL, {
    messages: buildTriggerMessages(description),
    response_format: TRIGGER_JSON_SCHEMA,
  });
  return parseTriggerResponse(response);
};

/** Persist the confirmed star into D1 via a per-request Drizzle connection. */
const insertStar = async (star: MemoryStar): Promise<MemoryStar> => {
  const { drizzle } = await import("drizzle-orm/d1");
  const db = drizzle(env.STARS_DB);
  await db.insert(memoryStars).values({
    id: star.id,
    text: star.text,
    mood: star.mood,
    color: star.color,
    r: star.r,
    angle: star.angle,
    brightness: star.brightness,
    // Routing + trigger (#219): the figure group, the captured trigger, and the
    // emotion-derived placement quartet are now written so a new star lands in the
    // right galaxy on the write path (not by the read-fallback accident). `name`/
    // `who` stay NULL on an AI-created star (the AI sets only emotion + trigger).
    grp: star.group ?? null,
    trigger: star.trigger ?? null,
    tier: star.placement?.tier ?? null,
    parentId: star.placement?.parentId ?? null,
    placementR: star.placement?.r ?? null,
    placementAngle: star.placement?.angle ?? null,
    createdAt: star.createdAt,
  });
  return star;
};

/** Step 1 — classify + route, NO persist (the confirm-first proposal). */
export const proposeStarFn = createServerFn({ method: "POST" })
  .inputValidator(validateInput)
  .handler(async ({ data }): Promise<ProposeMemoryResult> => {
    try {
      return await proposeMemory(data, {
        detectMood,
        detectTrigger,
        now: () => Date.now(),
        newId: () => crypto.randomUUID(),
      });
    } catch {
      // A transport / binding / model failure → an authored error, never a crash.
      return { ok: false, errorKey: "failed" };
    }
  });

/** Step 2 — persist the confirmed star. Reachable directly, so the payload is UNTRUSTED — `commitMemory` re-validates server-side (#221). */
export const commitStarFn = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown): MemoryStar => raw as MemoryStar)
  .handler(async ({ data }): Promise<CommitMemoryResult> => {
    try {
      return await commitMemory(data, { insert: insertStar });
    } catch {
      return { ok: false, errorKey: "failed" };
    }
  });
