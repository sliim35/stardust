import { describe, expect, it } from "vitest";
import {
  buildTriggerMessages,
  parseTriggerResponse,
  TRIGGER_JSON_SCHEMA,
} from "#/lib/galaxy/trigger-detect";

describe("buildTriggerMessages", () => {
  it("includes the user's memory and asks for person vs action", () => {
    const messages = buildTriggerMessages("dad dancing in the kitchen");
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain("dad dancing in the kitchen");
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    expect(system).toContain("person");
    expect(system).toContain("action");
  });
});

describe("TRIGGER_JSON_SCHEMA", () => {
  it("pins the model to exactly person | action", () => {
    expect(TRIGGER_JSON_SCHEMA.json_schema.properties.trigger.enum).toEqual([
      "person",
      "action",
    ]);
  });
});

describe("parseTriggerResponse", () => {
  it("reads the trigger from an object response", () => {
    expect(parseTriggerResponse({ response: { trigger: "person" } })).toBe(
      "person",
    );
    expect(parseTriggerResponse({ response: { trigger: "action" } })).toBe(
      "action",
    );
  });

  it("reads the trigger from a raw-JSON string response", () => {
    expect(parseTriggerResponse({ response: '{"trigger":"action"}' })).toBe(
      "action",
    );
  });

  it("is case/whitespace tolerant", () => {
    expect(parseTriggerResponse({ response: { trigger: " PERSON " } })).toBe(
      "person",
    );
  });

  it("returns null for an out-of-enum / malformed payload (non-fatal absence)", () => {
    expect(
      parseTriggerResponse({ response: { trigger: "weather" } }),
    ).toBeNull();
    expect(parseTriggerResponse({ response: "not json" })).toBeNull();
    expect(parseTriggerResponse(null)).toBeNull();
    expect(parseTriggerResponse({})).toBeNull();
  });
});
