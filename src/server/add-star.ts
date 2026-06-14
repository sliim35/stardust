/**
 * The "add your star" write-path server fn (ADR-0012 §5, ADR-0013 §1/§3) — the
 * thin Cloudflare-Workers edge around the pure `addMemory` orchestrator.
 *
 * SSR-safe (ADR-0003): `env`, `drizzle(env.STARS_DB)`, `env.AI`, `Date.now()`,
 * and `crypto.randomUUID()` are all touched INSIDE the handler (request scope) —
 * never at module scope. The pure logic (moderation, mood classification parsing,
 * field derivation) lives in `#/lib/galaxy/*` and is unit-tested without bindings;
 * this file only wires the real bindings to the injected deps.
 */

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { type AddMemoryResult, addMemory } from "#/lib/galaxy/add-memory";
import {
  buildMoodMessages,
  MOOD_JSON_SCHEMA,
  MOOD_MODEL,
  parseMoodResponse,
} from "#/lib/galaxy/mood-detect";
import { memoryStars } from "#/lib/galaxy/schema";
import type { MemoryStar, Mood } from "#/lib/galaxy/types";

/** Validate the raw client input into a string (defensive; moderation re-trims). */
const validateInput = (raw: unknown): string =>
  typeof raw === "string" ? raw : "";

/** Workers-AI mood classification via the per-request `env.AI` binding. */
const detectMood = async (description: string): Promise<Mood | null> => {
  const response = await env.AI.run(MOOD_MODEL, {
    messages: buildMoodMessages(description),
    response_format: MOOD_JSON_SCHEMA,
  });
  return parseMoodResponse(response);
};

/** Persist the derived star into D1 via a per-request Drizzle connection. */
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
    // `name` / `who` / `grp` / placement are absent on an AI-created star (the AI
    // sets only the mood); they stay NULL in D1 → absent again on read-back.
    createdAt: star.createdAt,
  });
  return star;
};

export const addStarFn = createServerFn({ method: "POST" })
  .inputValidator(validateInput)
  .handler(async ({ data }): Promise<AddMemoryResult> => {
    try {
      return await addMemory(data, {
        detectMood,
        insert: insertStar,
        now: () => Date.now(),
        newId: () => crypto.randomUUID(),
      });
    } catch {
      // A transport / binding / model failure → an authored error, never a crash.
      return { ok: false, errorKey: "failed" };
    }
  });
