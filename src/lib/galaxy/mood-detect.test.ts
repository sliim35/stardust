import { describe, expect, it } from "vitest";
import {
  buildMoodMessages,
  MOOD_JSON_SCHEMA,
  parseMoodResponse,
} from "#/lib/galaxy/mood-detect";
import { MOOD_VALUES } from "#/lib/galaxy/seed";

describe("parseMoodResponse", () => {
  it("accepts each of the 7 Mood literals from the structured response", () => {
    for (const mood of MOOD_VALUES) {
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
  it("constrains `mood` to exactly the 7 Mood literals", () => {
    expect(MOOD_JSON_SCHEMA.json_schema.properties.mood.enum).toEqual([
      ...MOOD_VALUES,
    ]);
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

  it("lists the 7 moods in the system instruction", () => {
    const messages = buildMoodMessages("any memory");
    const system = messages.find((msg) => msg.role === "system");
    for (const mood of MOOD_VALUES) {
      expect(system?.content).toContain(mood);
    }
  });
});
