import { describe, expect, it } from "vitest";
import { moderateMemory } from "#/lib/galaxy/moderation";

describe("moderateMemory", () => {
  it("accepts a normal memory and returns the lightly-trimmed text", () => {
    const result = moderateMemory("  a quiet evening on the porch  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("a quiet evening on the porch");
  });

  it("rejects an empty submission with the empty error key", () => {
    const result = moderateMemory("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("empty");
  });

  it("rejects a whitespace-only submission as empty", () => {
    const result = moderateMemory("   \n\t  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("empty");
  });

  it("rejects a non-string input as empty", () => {
    // The server fn validates upstream, but the guard is defensive.
    const result = moderateMemory(undefined as unknown as string);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("empty");
  });

  it("rejects an over-long submission with the tooLong error key", () => {
    const result = moderateMemory("x".repeat(1001));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("tooLong");
  });

  it("accepts a submission at exactly the max length", () => {
    const result = moderateMemory("x".repeat(1000));
    expect(result.ok).toBe(true);
  });

  it("flags a submission containing a blocked term with the flagged error key", () => {
    const result = moderateMemory("buy cheap viagra now click here");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("flagged");
  });

  it("flagging is case-insensitive", () => {
    const result = moderateMemory("FREE VIAGRA");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("flagged");
  });

  it("never mutates the memory text beyond trimming (no AI rewrite)", () => {
    const input = "Dad's terrible jokes — every Sunday, without fail.";
    const result = moderateMemory(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe(input);
  });
});
