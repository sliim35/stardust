import { describe, expect, it } from "vitest";
import {
  buildMoodMessages,
  MOOD_DISAMBIGUATION_PAIRS,
  MOOD_JSON_SCHEMA,
  parseMoodResponse,
} from "#/lib/galaxy/mood-detect";
import { EMOTION_VALUES } from "#/lib/galaxy/seed";

describe("parseMoodResponse", () => {
  it("accepts each of the 12 Emotion literals from the structured response", () => {
    for (const mood of EMOTION_VALUES) {
      expect(parseMoodResponse({ response: { mood } })).toBe(mood);
    }
  });

  it("reads the mood from a string `response` payload (JSON mode variant)", () => {
    expect(parseMoodResponse({ response: '{"mood":"peaceful"}' })).toBe(
      "peaceful",
    );
  });

  it("trims and lowercases a loosely-formatted mood before matching", () => {
    expect(parseMoodResponse({ response: { mood: "  Joyful " } })).toBe(
      "joyful",
    );
  });

  it("accepts a 12-widening emotion (e.g. longing) end-to-end", () => {
    expect(parseMoodResponse({ response: { mood: "longing" } })).toBe(
      "longing",
    );
  });

  it("returns null for an out-of-enum mood (handler maps null → an error key)", () => {
    expect(parseMoodResponse({ response: { mood: "ecstatic" } })).toBeNull();
  });

  it("returns null for a malformed / empty response", () => {
    expect(parseMoodResponse({})).toBeNull();
    expect(parseMoodResponse({ response: null })).toBeNull();
    expect(parseMoodResponse({ response: "not json" })).toBeNull();
    expect(parseMoodResponse(null)).toBeNull();
  });
});

describe("MOOD_JSON_SCHEMA", () => {
  it("constrains `mood` to exactly the 12 Emotion literals (single source)", () => {
    expect(MOOD_JSON_SCHEMA.json_schema.properties.mood.enum).toEqual([
      ...EMOTION_VALUES,
    ]);
  });

  it("derives the enum from EMOTION_VALUES, not a hardcoded 7-list", () => {
    expect(MOOD_JSON_SCHEMA.json_schema.properties.mood.enum).toHaveLength(12);
  });

  it("requires the mood field", () => {
    expect(MOOD_JSON_SCHEMA.json_schema.required).toContain("mood");
  });
});

describe("buildMoodMessages", () => {
  it("includes the user's description verbatim in the user turn", () => {
    const messages = buildMoodMessages("rain on the tin roof");
    const user = messages.find((msg) => msg.role === "user");
    expect(user?.content).toContain("rain on the tin roof");
  });

  it("lists all 12 emotions in the system instruction", () => {
    const messages = buildMoodMessages("any memory");
    const system = messages.find((msg) => msg.role === "system");
    for (const mood of EMOTION_VALUES) {
      expect(system?.content).toContain(mood);
    }
  });

  it("includes near-pair disambiguation for every hard pair", () => {
    const messages = buildMoodMessages("any memory");
    const system = messages.find((msg) => msg.role === "system")?.content ?? "";
    // Each hard near-pair must name BOTH members in the disambiguation guidance.
    for (const [a, b] of MOOD_DISAMBIGUATION_PAIRS) {
      expect(system).toContain(a);
      expect(system).toContain(b);
    }
  });

  it("declares the five hard near-pairs the spike flagged (AC2)", () => {
    // hope/wonder, gratitude/tender, longing/wistful, pride/joyful, courage/hope
    expect(MOOD_DISAMBIGUATION_PAIRS).toEqual([
      ["hope", "wonder"],
      ["gratitude", "tender"],
      ["longing", "wistful"],
      ["pride", "joyful"],
      ["courage", "hope"],
    ]);
  });
});
