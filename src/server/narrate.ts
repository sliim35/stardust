/**
 * The cached-narration server fn (ADR-0013 §1/§2/§5) — the thin Cloudflare-Workers
 * edge around the pure `cachedNarration` orchestrator.
 *
 * SSR-safe (ADR-0003): `env.AI` and `env.NARRATION_KV` are touched ONLY inside the
 * handler (request scope) — never at module scope. The pure logic (key normalizer,
 * write-through cache, prompt builder, response parser) lives in `#/lib/galaxy/*`
 * and is unit-tested without bindings; this file only wires the real bindings.
 *
 * Trigger contract (the build-story choice): the client passes a stable narration
 * key (a real object's `loreKey`) plus the English subject name. The handler reads
 * `narration:{key}` from KV; on a miss it generates once via `env.AI`, writes
 * through with a 30-day TTL, and serves. English-only MVP — the key carries no
 * locale segment (ADR-0013 §2/§4).
 *
 * Graceful (ADR-0013 §5): every failure (a missing binding, a KV/AI error) degrades
 * to `null` — the read-only sky still renders. `cachedNarration` swallows KV/gen
 * errors; the outer try/catch covers a missing binding so the import-time alias in
 * tests and an unbound dev environment both stay non-fatal.
 */

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import {
  buildNarrationMessages,
  NARRATION_MODEL,
  parseNarrationResponse,
} from "#/lib/galaxy/narrate-ai";
import { cachedNarration } from "#/lib/galaxy/narration";

/** Cached narration TTL — a fact is stable, so a long window (30 days, seconds). */
const NARRATION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** The client request: the stable cache key + the English subject for the prompt. */
export type NarrateInput = { key: string; subject: string };

/** Validate the raw client input into a `NarrateInput` (defensive; non-strings → ""). */
const validateInput = (raw: unknown): NarrateInput => {
  const o = (raw ?? {}) as Partial<NarrateInput>;
  return {
    key: typeof o.key === "string" ? o.key : "",
    subject: typeof o.subject === "string" ? o.subject : "",
  };
};

export const narrateFn = createServerFn({ method: "GET" })
  .inputValidator(validateInput)
  .handler(async ({ data }): Promise<string | null> => {
    if (data.key.trim().length === 0) return null;
    try {
      return await cachedNarration(data.key, {
        get: (k) => env.NARRATION_KV.get(k),
        put: (k, v) =>
          env.NARRATION_KV.put(k, v, {
            expirationTtl: NARRATION_TTL_SECONDS,
          }).then(() => undefined),
        generate: async (rawKey) => {
          const subject = data.subject.trim() || rawKey;
          const response = await env.AI.run(NARRATION_MODEL, {
            messages: buildNarrationMessages(subject),
          });
          return parseNarrationResponse(response) ?? "";
        },
      });
    } catch {
      // A missing binding (unbound dev / tests) or an unexpected edge failure →
      // no narration, never a crash. The sky still renders (ADR-0013 §5).
      return null;
    }
  });
