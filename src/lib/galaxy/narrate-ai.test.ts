import { describe, expect, it } from "vitest";
import {
  buildNarrationMessages,
  NARRATION_MAX_CHARS,
  NARRATION_MODEL,
  parseNarrationResponse,
} from "#/lib/galaxy/narrate-ai";

describe("buildNarrationMessages (the pure prompt builder)", () => {
  it("names the subject in the user message", () => {
    const messages = buildNarrationMessages("The Milky Way");
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain("The Milky Way");
  });

  it("has a system message that frames ASTRO as a short-fact narrator", () => {
    const messages = buildNarrationMessages("Andromeda");
    const system = messages.find((m) => m.role === "system");
    expect(system).toBeDefined();
    expect(system?.content.length).toBeGreaterThan(0);
  });

  it("is a pure function — same subject yields the same messages", () => {
    expect(buildNarrationMessages("Sgr A*")).toEqual(
      buildNarrationMessages("Sgr A*"),
    );
  });
});

describe("parseNarrationResponse (the pure response parser)", () => {
  it("reads the `response` string off a Workers-AI text result", () => {
    expect(parseNarrationResponse({ response: "  A bright fact.  " })).toBe(
      "A bright fact.",
    );
  });

  it("accepts a bare string response", () => {
    expect(parseNarrationResponse("A bright fact.")).toBe("A bright fact.");
  });

  it("returns null for a malformed / empty payload (no narration, never a crash)", () => {
    expect(parseNarrationResponse(null)).toBeNull();
    expect(parseNarrationResponse(undefined)).toBeNull();
    expect(parseNarrationResponse({})).toBeNull();
    expect(parseNarrationResponse({ response: "" })).toBeNull();
    expect(parseNarrationResponse({ response: "   " })).toBeNull();
    expect(parseNarrationResponse({ response: 42 })).toBeNull();
  });

  it("clamps an over-long narration to the max length", () => {
    const long = "x".repeat(NARRATION_MAX_CHARS + 200);
    const out = parseNarrationResponse({ response: long });
    expect(out).not.toBeNull();
    expect((out as string).length).toBeLessThanOrEqual(NARRATION_MAX_CHARS);
  });
});

describe("NARRATION_MODEL", () => {
  it("is a recorded Workers AI text model id", () => {
    expect(NARRATION_MODEL).toMatch(/^@cf\//);
  });
});
