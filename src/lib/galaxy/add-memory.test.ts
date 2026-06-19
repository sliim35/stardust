import { describe, expect, it, vi } from "vitest";
import type { AddMemoryDeps } from "#/lib/galaxy/add-memory";
import { addMemory } from "#/lib/galaxy/add-memory";
import { MOODS, placeStar } from "#/lib/galaxy/seed";
import type { MemoryStar, Mood } from "#/lib/galaxy/types";

/** Default deps: a fixed clock + id, a mood stub, and a spy insert. */
const deps = (over: Partial<AddMemoryDeps> = {}) => {
  const detectMood = vi.fn<(d: string) => Promise<Mood | null>>(
    async () => "joyful",
  );
  const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
    async (star) => star,
  );
  return {
    detectMood,
    insert,
    now: () => 1748100000000,
    newId: () => "u-fixed",
    ...over,
  };
};

describe("addMemory (the write-path orchestrator)", () => {
  it("on a valid memory: classifies the mood, derives the star, and inserts it once", async () => {
    const d = deps();
    const result = await addMemory("a quiet evening", d);

    expect(result.ok).toBe(true);
    expect(d.detectMood).toHaveBeenCalledTimes(1);
    expect(d.detectMood).toHaveBeenCalledWith("a quiet evening");
    expect(d.insert).toHaveBeenCalledTimes(1);
    if (result.ok) {
      expect(result.star.mood).toBe("joyful");
      expect(result.star.color).toBe(MOODS.joyful.color);
      const { r, angle } = placeStar("u-fixed", "joyful");
      expect(result.star.r).toBe(r);
      expect(result.star.angle).toBe(angle);
      expect(result.star.id).toBe("u-fixed");
      expect(result.star.createdAt).toBe(1748100000000);
      expect(result.star.text).toBe("a quiet evening");
    }
  });

  it("AI sets ONLY the mood — egg/deep/placement are never on the produced star", async () => {
    const d = deps();
    const result = await addMemory("a memory", d);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("egg" in result.star).toBe(false);
      expect("deep" in result.star).toBe(false);
      expect("placement" in result.star).toBe(false);
    }
  });

  it("MODERATION GATE: an empty submission is rejected BEFORE the AI + insert", async () => {
    const d = deps();
    const result = await addMemory("   ", d);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("empty");
    // never reaches the model or D1
    expect(d.detectMood).not.toHaveBeenCalled();
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("MODERATION GATE: a flagged submission is rejected BEFORE the AI + insert", async () => {
    const d = deps();
    const result = await addMemory("free viagra here", d);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("flagged");
    expect(d.detectMood).not.toHaveBeenCalled();
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("inserts the user's own trimmed text — never an AI-rewritten version", async () => {
    const d = deps();
    await addMemory("  the blue door  ", d);
    expect(d.insert).toHaveBeenCalledWith(
      expect.objectContaining({ text: "the blue door" }),
    );
  });

  it("when the model returns an unclassifiable mood, rejects with the unclear error and never inserts", async () => {
    const d = deps({ detectMood: vi.fn(async () => null) });
    const result = await addMemory("a memory the model cannot place", d);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("unclear");
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("returns the inserted star (so the server fn can ignite it in the live sky)", async () => {
    const d = deps();
    const result = await addMemory("a memory", d);
    expect(result.ok).toBe(true);
    if (result.ok) expect(d.insert).toHaveBeenCalledWith(result.star);
  });
});
