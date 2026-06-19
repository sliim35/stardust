/**
 * Workers-AI mood detection (ADR-0013 §1/§3) — split into a PURE core (the
 * prompt builder, the JSON-mode schema, and the response parser, all
 * headless-testable) and a thin async edge (`detectMood`) that calls `env.AI`.
 *
 * The classifier is constrained to the 7 `Mood` literals via JSON mode
 * (`response_format: json_schema`), so the model returns exactly one enum value.
 * That `mood` is the ONLY AI-provided field crossing into the store (ADR-0012 §6);
 * the handler derives every other field (`add-star.ts`). The user's `text` is
 * NEVER sent to be rewritten — only to be classified.
 *
 * Model: `@cf/meta/llama-3.1-8b-instruct-fast` — a current Workers AI text model
 * that supports JSON mode (structured output), low-latency at this scale, no
 * external key. The Haiku upgrade (#182) swaps the edge behind the same parser.
 */

import { isMood, MOOD_VALUES } from "#/lib/galaxy/seed";
import type { Mood } from "#/lib/galaxy/types";

/** The Workers AI text model id used for mood classification (recorded per ADR). */
export const MOOD_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast" as const;

/** The JSON-mode schema constraining the model to exactly one of the 7 moods. */
export const MOOD_JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    type: "object",
    properties: {
      mood: {
        type: "string",
        enum: [...MOOD_VALUES],
      },
    },
    required: ["mood"],
  },
} as const;

type ChatMessage = { role: "system" | "user"; content: string };

/** Build the classification prompt — system instruction + the user's description. */
export const buildMoodMessages = (description: string): ChatMessage[] => [
  {
    role: "system",
    content: [
      "You classify the emotional mood of a short personal memory.",
      `Choose EXACTLY ONE mood from this set: ${MOOD_VALUES.join(", ")}.`,
      "Respond only with the chosen mood as structured JSON. Do not add commentary.",
      "Guidance: joyful = bright happiness; tender = love/closeness; grieving = loss/mourning;",
      "wistful = bittersweet longing; peaceful = calm/contentment; nostalgic = fond remembering;",
      "wonder = awe/curiosity.",
    ].join("\n"),
  },
  { role: "user", content: `Memory: ${description}` },
];

/**
 * Extract a `Mood` from a Workers AI JSON-mode response. Accepts both an object
 * `response` (`{ mood }`) and a string `response` (raw JSON), trims/lowercases,
 * and returns `null` for any malformed / out-of-enum payload so the handler can
 * map it to an authored error (a wrong mood is permanent — never guess a default).
 */
export const parseMoodResponse = (raw: unknown): Mood | null => {
  if (raw === null || typeof raw !== "object") return null;
  const response = (raw as { response?: unknown }).response;

  let moodValue: unknown;
  if (response !== null && typeof response === "object") {
    moodValue = (response as { mood?: unknown }).mood;
  } else if (typeof response === "string") {
    try {
      moodValue = (JSON.parse(response) as { mood?: unknown }).mood;
    } catch {
      return null;
    }
  } else {
    return null;
  }

  if (typeof moodValue !== "string") return null;
  const normalized = moodValue.trim().toLowerCase();
  return isMood(normalized) ? normalized : null;
};
