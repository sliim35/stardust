/**
 * Workers-AI narration generation (ADR-0013 §1/§2) — split, like `mood-detect.ts`,
 * into a PURE core (the prompt builder + the response parser, both headless-testable)
 * and a thin async edge (`src/server/narrate.ts`) that calls `env.AI`.
 *
 * This is a **text** generation (contrast with #183's structured-output mood enum):
 * ASTRO narrates a short interesting fact / story about the galaxy or one of its
 * objects, in its quiet, wistful, first-person tour-guide voice. The generated
 * text is content (not catalog chrome) and is English-only for the MVP (ADR-0013
 * §4; ru → #182).
 *
 * Model: `@cf/meta/llama-3.1-8b-instruct-fast` — a current Workers AI text model,
 * low-latency at this scale, no external key. Recorded per ADR-0013 §1 ("the exact
 * model id is a build-story detail"). The Haiku upgrade (#182) swaps the edge behind
 * the same parser. Reuses #183's model family for one less moving part.
 */

/** The Workers AI text model id used for narration (recorded per ADR-0013 §1). */
export const NARRATION_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast" as const;

/** A short narration — clamp the model output so a single bubble stays readable. */
export const NARRATION_MAX_CHARS = 280 as const;

type ChatMessage = { role: "system" | "user"; content: string };

/**
 * Build the narration prompt — ASTRO's voice in the system message + the named
 * subject in the user message. Pure: a given subject always builds the same prompt.
 */
export const buildNarrationMessages = (subject: string): ChatMessage[] => [
  {
    role: "system",
    content: [
      "You are ASTRO, the quiet guide of a galaxy of memories.",
      "Narrate ONE short, true, interesting fact about the subject — a story or a",
      "wonder, in a warm, wistful, first-person voice.",
      "Keep it to one or two sentences, under 50 words. No lists, no preamble,",
      "no markdown — just the line ASTRO would say.",
    ].join(" "),
  },
  { role: "user", content: `Narrate an interesting fact about: ${subject}` },
];

/**
 * Extract the narration text from a Workers AI text result. Accepts both the
 * `{ response: string }` object shape and a bare string, trims, clamps to
 * `NARRATION_MAX_CHARS`, and returns `null` for any malformed / empty payload so
 * the orchestrator shows no narration rather than a broken view (ADR-0013 §5).
 */
export const parseNarrationResponse = (raw: unknown): string | null => {
  let value: unknown;
  if (typeof raw === "string") {
    value = raw;
  } else if (raw !== null && typeof raw === "object") {
    value = (raw as { response?: unknown }).response;
  } else {
    return null;
  }

  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length === 0) return null;
  return text.length > NARRATION_MAX_CHARS
    ? text.slice(0, NARRATION_MAX_CHARS).trimEnd()
    : text;
};
