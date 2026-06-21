// Workers-AI trigger classifier (BR28, ADR-0014 §4): label what sparked a memory —
// metadata only, so an unclassifiable answer is non-fatal (caller drops it → no chip).

import { TRIGGER_VALUES } from "#/lib/galaxy/schema";
import type { Trigger } from "#/lib/galaxy/types";

/** Same Workers-AI text model as the emotion classifier (one model, two prompts). */
export const TRIGGER_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast" as const;

// `enum` spreads `TRIGGER_VALUES` so the D1 column + this classifier can't drift.
export const TRIGGER_JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    type: "object",
    properties: {
      trigger: {
        type: "string",
        enum: [...TRIGGER_VALUES],
      },
    },
    required: ["trigger"],
  },
} as const;

type ChatMessage = { role: "system" | "user"; content: string };

// Classify on meaning, not keywords — the text is labelled, never rewritten.
export const buildTriggerMessages = (description: string): ChatMessage[] => [
  {
    role: "system",
    content: [
      "You label what sparked a personal memory: a PERSON or an ACTION/event.",
      "- person: the memory is centred on someone — a relationship, a face, being with them.",
      "- action: the memory is centred on a moment, a place, or an event — something that happened.",
      "Choose the single dominant one. When a memory is about doing something WITH a person, prefer the one the memory dwells on most: if it's the bond, person; if it's the happening, action.",
      "Respond with ONLY the chosen label as structured JSON (the `trigger` field). No commentary.",
    ].join("\n"),
  },
  { role: "user", content: `Memory: ${description}` },
];

export const isTrigger = (value: unknown): value is Trigger =>
  typeof value === "string" &&
  (TRIGGER_VALUES as readonly string[]).includes(value);

// `null` on any malformed / out-of-enum payload — absence is "no chip", not a default.
export const parseTriggerResponse = (raw: unknown): Trigger | null => {
  if (raw === null || typeof raw !== "object") return null;
  const response = (raw as { response?: unknown }).response;

  let value: unknown;
  if (response !== null && typeof response === "object") {
    value = (response as { trigger?: unknown }).trigger;
  } else if (typeof response === "string") {
    try {
      value = (JSON.parse(response) as { trigger?: unknown }).trigger;
    } catch {
      return null;
    }
  } else {
    return null;
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isTrigger(normalized) ? normalized : null;
};
