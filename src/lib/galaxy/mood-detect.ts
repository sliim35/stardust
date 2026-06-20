/**
 * Workers-AI emotion classification (ADR-0013 §1/§3, ADR-0014 §1) — split into a
 * PURE core (the prompt builder, the JSON-mode schema, and the response parser, all
 * headless-testable) and a thin async edge (`detectMood` in `src/server/add-star.ts`)
 * that calls `env.AI`.
 *
 * The classifier is constrained to the 12 `Emotion` literals via JSON mode
 * (`response_format: json_schema`), so the model returns exactly one enum value. The
 * enum derives from `EMOTION_VALUES` — the SINGLE source shared by the Drizzle column,
 * the `Emotion` type, and this classifier (`seed.ts`) — so the DB, the AI, and the type
 * can never drift apart. That `mood` is the ONLY AI-provided field crossing into the
 * store (ADR-0012 §6); the handler derives every other field (`add-star.ts`). The
 * user's `text` is NEVER sent to be rewritten — only to be classified.
 *
 * The 7→12 widening (#187/#193) makes several emotions sit close together, so the
 * system prompt carries explicit near-pair disambiguation (`MOOD_DISAMBIGUATION_PAIRS`)
 * for the hard pairs the spike flagged: hope/wonder, gratitude/tender, longing/wistful,
 * pride/joyful, courage/hope. A `*.smoke.ts` file (excluded from the default Vitest run)
 * scores live accuracy against a 54-fixture set — a non-blocking regression guard, run
 * manually against the real `env.AI` (see `mood-detect.smoke.ts`).
 *
 * Model: `@cf/meta/llama-3.1-8b-instruct-fast` — a current Workers AI text model that
 * supports JSON mode (structured output), low-latency at this scale, no external key.
 * The Haiku upgrade (#182) — NOT a ship-gate — swaps the edge behind the same parser.
 */

import { EMOTION_VALUES, isMood } from "#/lib/galaxy/seed";
import type { Emotion } from "#/lib/galaxy/types";

/** The Workers AI text model id used for emotion classification (recorded per ADR). */
export const MOOD_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast" as const;

/**
 * The JSON-mode schema constraining the model to exactly one of the 12 emotions. The
 * enum spreads `EMOTION_VALUES` (single source) — never a hardcoded literal list — so
 * widening the partition updates the classifier automatically.
 */
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

/**
 * One-line sense of each emotion, in `EMOTION_VALUES` order. Keeps the 12-way glossary
 * the system prompt lists co-located with the enum so the two can't silently diverge.
 */
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

/**
 * The hard near-pairs the spike (#193) flagged as the classifier's biggest confusions.
 * Each entry is `[a, b]` — two emotions that share surface words but differ in stance;
 * the system prompt carries an explicit contrast for each (`PAIR_GUIDANCE`). Exported so
 * the prompt-construction test can assert every pair is disambiguated in the messages.
 */
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

/**
 * The `${a}|${b}` key for every pair in `MOOD_DISAMBIGUATION_PAIRS`, derived per-tuple so
 * `PAIR_GUIDANCE` is exhaustive by construction: a pair without guidance (or a typo'd key)
 * is a COMPILE error, not a runtime `undefined` slipping into the prompt. The mapped type
 * keys each tuple individually — `(typeof PAIRS)[number]` would union the elements first and
 * yield the a×b cross-product instead of the 5 real keys.
 */
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

/**
 * Build the `${a}|${b}` lookup key from one near-pair tuple. The generic infers each
 * tuple's literal elements WITHOUT widening (destructuring `[a, b]` off the array would
 * union both columns into the a×b cross-product), so the result is a real `PairGuidanceKey`
 * and the `PAIR_GUIDANCE[...]` lookup is statically exhaustive — never `string | undefined`.
 */
const pairGuidanceKey = <P extends readonly [Emotion, Emotion]>(
  pair: P,
): PairKeyOf<P> => `${pair[0]}|${pair[1]}` as PairKeyOf<P>;

type ChatMessage = { role: "system" | "user"; content: string };

/**
 * Build the 12-way classification prompt — a system instruction (the emotion glossary +
 * near-pair disambiguation + answering rules) followed by the user's memory. ~900 tokens
 * of guidance: every emotion is glossed and every hard pair gets an explicit contrast, so
 * the model leans on meaning, not surface keywords. The user `text` is classified, never
 * rewritten.
 */
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

/**
 * Extract an `Emotion` from a Workers AI JSON-mode response. Accepts both an object
 * `response` (`{ mood }`) and a string `response` (raw JSON), trims/lowercases, and
 * returns `null` for any malformed / out-of-enum payload so the handler can map it to
 * an authored error (a wrong emotion is permanent — never guess a default).
 */
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
