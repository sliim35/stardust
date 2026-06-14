/**
 * Inline moderation gate for a submitted memory (ADR-0013 §3). Runs in the Worker
 * handler BEFORE `addStar`, so an empty / over-long / flagged submission never
 * reaches D1 and the visitor sees an authored `chat.error.*` message.
 *
 * The memory `text` is the USER's own — this only TRIMS it (light); it is never
 * AI-rewritten or translated (ADR-0013 §3). Pure + transport-free so it's
 * headless-testable; the server fn maps `errorKey` → the `chat.error.*` catalog.
 *
 * MVP scope: a length bound + a small blocked-term denylist. A richer moderation
 * pass (e.g. a model classifier) can be added later without changing the flow
 * (ADR-0013 §3) — the `errorKey` union is the seam.
 */

/** Max stored memory length (chars). Keeps a single star's `text` panel-sized. */
export const MEMORY_MAX_LENGTH = 1000;

/** The `chat.error.*` catalog key a rejected submission maps to. */
export type ModerationErrorKey = "empty" | "tooLong" | "flagged";

export type ModerationResult =
  | { ok: true; text: string }
  | { ok: false; errorKey: ModerationErrorKey };

// A deliberately tiny MVP denylist (spam/abuse markers). Lowercased; matched
// case-insensitively as substrings. Not exhaustive — the model-classifier upgrade
// is tracked alongside the Haiku migration (#182).
const BLOCKED_TERMS = ["viagra", "casino", "porn"] as const;

export const moderateMemory = (input: string): ModerationResult => {
  if (typeof input !== "string") return { ok: false, errorKey: "empty" };

  const text = input.trim();
  if (text.length === 0) return { ok: false, errorKey: "empty" };
  if (text.length > MEMORY_MAX_LENGTH)
    return { ok: false, errorKey: "tooLong" };

  const haystack = text.toLowerCase();
  if (BLOCKED_TERMS.some((term) => haystack.includes(term))) {
    return { ok: false, errorKey: "flagged" };
  }

  return { ok: true, text };
};
