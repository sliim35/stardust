// Workers-AI emotion classifier (ADR-0013/0014). Pure core; enum derives from EMOTION_VALUES (single source, never hardcoded); text is classified, never rewritten (ADR-0012 §6).

import { EMOTION_VALUES, isMood } from "#/lib/galaxy/seed";
import type { Emotion } from "#/lib/galaxy/types";

/** The Workers AI text model id used for emotion classification (recorded per ADR). */
export const MOOD_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast" as const;

// JSON-mode schema pinning the model to one of the 12 emotions; `enum` spreads `EMOTION_VALUES` (single source), so widening the partition updates the classifier automatically.
export const MOOD_JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    type: "object",
    properties: {
      mood: {
        type: "string",
        enum: [...EMOTION_VALUES],
      },
    },
    required: ["mood"],
  },
} as const;

// One-line sense of each emotion; co-located with the enum so the prompt glossary can't silently diverge from `EMOTION_VALUES`.
const EMOTION_GLOSS = {
  joyful: "bright, present happiness; delight, fun, celebration",
  tender: "warm love and closeness toward a person; affection, intimacy, care",
  grieving: "active loss and mourning; sorrow at someone or something gone",
  wonder: "awe and curiosity at something vast/new/mysterious; being amazed",
  nostalgic: "fond looking-back at a happy past; warm remembering, not pain",
  hope: "looking forward with trust that something good is coming; aspiration",
  peaceful: "calm contentment and stillness; at ease, settled, serene",
  wistful: "bittersweet, gentle ache for something past or unreachable",
  gratitude: "thankfulness FOR a gift/help received; being appreciative",
  courage: "facing fear or hardship; bravery, resolve, standing firm",
  pride: "earned self-worth in an achievement (own or a loved one's)",
  longing: "yearning to have/reach someone or something absent; deep wanting",
} as const satisfies Record<Emotion, string>;

// The hard near-pairs the spike (#193) flagged; each `[a, b]` gets an explicit contrast in `PAIR_GUIDANCE`. Exported so the prompt test can assert every pair is disambiguated.
export const MOOD_DISAMBIGUATION_PAIRS = [
  ["hope", "wonder"],
  ["gratitude", "tender"],
  ["longing", "wistful"],
  ["pride", "joyful"],
  ["courage", "hope"],
] as const satisfies readonly (readonly [Emotion, Emotion])[];

/** The `${a}|${b}` key a single near-pair tuple maps to (non-distributive over a union). */
type PairKeyOf<P> = P extends readonly [
  infer A extends string,
  infer B extends string,
]
  ? `${A}|${B}`
  : never;

// Per-tuple mapped type, not `[number]` union — keys are exactly the 5 real pairs, not the a×b cross-product, so `PAIR_GUIDANCE` is exhaustive at compile time.
type PairGuidanceKey = {
  [K in keyof typeof MOOD_DISAMBIGUATION_PAIRS]: PairKeyOf<
    (typeof MOOD_DISAMBIGUATION_PAIRS)[K]
  >;
}[number];

/** The explicit contrast guidance for each hard near-pair, keyed by `${a}|${b}`. */
const PAIR_GUIDANCE = {
  "hope|wonder":
    'hope vs wonder — hope FACES FORWARD to a wanted future outcome ("it will get better", "I can\'t wait"); wonder is AWE at the present vastness/mystery itself, with no wanting attached. A starry sky that simply astonishes = wonder; a wish on that star = hope.',
  "gratitude|tender":
    'gratitude vs tender — gratitude is THANKFULNESS for a gift/help RECEIVED ("I\'m so grateful they were there"); tender is the warm love/closeness FELT TOWARD a person ("holding her hand"). If the memory thanks someone for something, gratitude; if it just dwells in closeness, tender.',
  "longing|wistful":
    'longing vs wistful — longing is an ACTIVE, aching YEARNING to reach/have something absent now ("I wish you were here"); wistful is the gentler, more accepting BITTERSWEET ache of looking back ("those days are gone, and I smile"). Longing reaches; wistful sighs.',
  "pride|joyful":
    'pride vs joyful — pride is EARNED self-worth in an ACHIEVEMENT (own or a loved one\'s: "she graduated", "I finally did it"); joyful is undirected bright happiness/fun with no accomplishment behind it. If a hard-won win is the cause, pride; if it\'s just delight, joyful.',
  "courage|hope":
    "courage vs hope — courage is FACING fear/hardship in the moment (bravery, resolve, standing firm despite); hope is the forward-looking trust that good will come. Courage acts against fear NOW; hope expects good LATER. Stepping onstage terrified = courage; believing it'll go well = hope.",
} as const satisfies Record<PairGuidanceKey, string>;

// Generic prevents destructuring widening — keeps the key a literal `${a}|${b}`, not `${Emotion}|${Emotion}`, so the `PAIR_GUIDANCE` lookup is never `string | undefined`.
const pairGuidanceKey = <P extends readonly [Emotion, Emotion]>(
  pair: P,
): PairKeyOf<P> => `${pair[0]}|${pair[1]}` as PairKeyOf<P>;

type ChatMessage = { role: "system" | "user"; content: string };

// Build the 12-way prompt: system instruction (glossary + near-pair contrasts + rules) then the user's memory, so the model leans on meaning, not keywords. Text is classified, never rewritten.
export const buildMoodMessages = (description: string): ChatMessage[] => {
  const glossary = EMOTION_VALUES.map(
    (e) => `- ${e}: ${EMOTION_GLOSS[e]}`,
  ).join("\n");
  const disambiguation = MOOD_DISAMBIGUATION_PAIRS.map(
    (pair) => `- ${PAIR_GUIDANCE[pairGuidanceKey(pair)]}`,
  ).join("\n");

  return [
    {
      role: "system",
      content: [
        "You are an emotion classifier for a personal-memory galaxy. Read a short memory and label its single dominant emotion.",
        `Choose EXACTLY ONE emotion from this set of 12: ${EMOTION_VALUES.join(", ")}.`,
        "",
        "What each emotion means:",
        glossary,
        "",
        "These pairs are easy to confuse — read the contrast and pick the closer one:",
        disambiguation,
        "",
        "How to decide:",
        "- Label the DOMINANT feeling the memory leaves, not every emotion it touches.",
        "- A memory about a person you love is not automatically tender — weigh what the memory DOES (thank -> gratitude, yearn -> longing, mourn -> grieving).",
        "- Looking BACKWARD warmly = nostalgic; backward bittersweetly = wistful; FORWARD trustingly = hope; yearning toward the absent = longing.",
        "- Awe with no wanting = wonder; a hard-won achievement = pride; bravery against fear = courage; calm stillness = peaceful; thankfulness for a gift = gratitude.",
        "- When two fit, prefer the more SPECIFIC emotion over the generic one (pride over joyful, gratitude over tender, longing over wistful).",
        "",
        "Respond with ONLY the chosen emotion as structured JSON (the `mood` field). No commentary, no explanation.",
      ].join("\n"),
    },
    { role: "user", content: `Memory: ${description}` },
  ];
};

// Extract an `Emotion` from a Workers-AI JSON-mode response (object `{ mood }` or raw-JSON string); returns `null` for any malformed / out-of-enum payload — never guess a default.
export const parseMoodResponse = (raw: unknown): Emotion | null => {
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
