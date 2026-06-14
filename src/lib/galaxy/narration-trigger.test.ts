import { describe, expect, it } from "vitest";
import { narrationRequestFor } from "#/lib/galaxy/narration-trigger";
import { en } from "#/lib/i18n/messages/en";

describe("narrationRequestFor (a clicked real object → a narration request)", () => {
  it("keys the request by the object's loreKey and names the subject from the catalog", () => {
    const milkyWay = { loreKey: "milkyWay" as const };
    const req = narrationRequestFor(milkyWay, en.lore);
    expect(req).toEqual({ key: "milkyWay", subject: en.lore.milkyWay.name });
  });

  it("uses the active-locale catalog's English subject name (MVP English-only)", () => {
    const andromeda = { loreKey: "andromeda" as const };
    const req = narrationRequestFor(andromeda, en.lore);
    expect(req.subject).toBe("Andromeda");
  });

  it("falls back to the loreKey as the subject when the catalog entry is missing", () => {
    // A defensive path — the union keeps loreKey compile-locked, but a runtime
    // catalog gap must never produce an empty subject.
    const partial = {} as Record<string, { name: string }>;
    const req = narrationRequestFor({ loreKey: "sgrA" as const }, partial);
    expect(req).toEqual({ key: "sgrA", subject: "sgrA" });
  });
});
