import { describe, expect, it, vi } from "vitest";
import type { ProposeMemoryDeps } from "#/lib/galaxy/add-memory";
import { commitMemory, proposeMemory } from "#/lib/galaxy/add-memory";
import { hostGalaxyFor, MOODS, placeStar } from "#/lib/galaxy/seed";
import type { MemoryStar, Mood, Trigger } from "#/lib/galaxy/types";

/** Default deps: a fixed clock + id, a mood/trigger stub. */
const deps = (over: Partial<ProposeMemoryDeps> = {}) => {
  const detectMood = vi.fn<(d: string) => Promise<Mood | null>>(
    async () => "joyful" as Mood,
  );
  const detectTrigger = vi.fn<(d: string) => Promise<Trigger | null>>(
    async () => "person" as Trigger,
  );
  return {
    detectMood,
    detectTrigger,
    now: () => 1748100000000,
    newId: () => "u-fixed",
    ...over,
  };
};

describe("proposeMemory (classify + route — NO persist, the confirm-first step)", () => {
  it("on a valid memory: classifies emotion + trigger and derives the routed star", async () => {
    const d = deps();
    const result = await proposeMemory("a quiet evening", d);

    expect(result.ok).toBe(true);
    expect(d.detectMood).toHaveBeenCalledTimes(1);
    expect(d.detectMood).toHaveBeenCalledWith("a quiet evening");
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

  it("surfaces the host galaxy id so the UI can name the target before persist (AC2)", async () => {
    const d = deps({ detectMood: vi.fn(async (): Promise<Mood> => "wonder") });
    const result = await proposeMemory("the rings of saturn", d);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hostGalaxyId).toBe("andromeda");
      expect(result.hostGalaxyId).toBe(hostGalaxyFor("wonder"));
      expect(result.star.placement?.parentId).toBe("andromeda");
    }
  });

  it("captures the classified trigger onto the proposed star (AC1)", async () => {
    const d = deps({
      detectTrigger: vi.fn(async (): Promise<Trigger> => "action"),
    });
    const result = await proposeMemory("the snow-day morning", d);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.star.trigger).toBe("action");
  });

  it("an unclassifiable trigger is non-fatal — the star is proposed without one", async () => {
    const d = deps({ detectTrigger: vi.fn(async () => null) });
    const result = await proposeMemory("a memory", d);
    expect(result.ok).toBe(true);
    if (result.ok) expect("trigger" in result.star).toBe(false);
  });

  it("AI sets ONLY emotion/trigger — egg/deep are never on the proposed star", async () => {
    const d = deps();
    const result = await proposeMemory("a memory", d);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("egg" in result.star).toBe(false);
      expect("deep" in result.star).toBe(false);
    }
  });

  it("MODERATION GATE: an empty submission is rejected BEFORE the AI", async () => {
    const d = deps();
    const result = await proposeMemory("   ", d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("empty");
    expect(d.detectMood).not.toHaveBeenCalled();
    expect(d.detectTrigger).not.toHaveBeenCalled();
  });

  it("MODERATION GATE: a flagged submission is rejected BEFORE the AI", async () => {
    const d = deps();
    const result = await proposeMemory("free viagra here", d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("flagged");
    expect(d.detectMood).not.toHaveBeenCalled();
  });

  it("proposes the user's own trimmed text — never an AI-rewritten version", async () => {
    const d = deps();
    const result = await proposeMemory("  the blue door  ", d);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.star.text).toBe("the blue door");
  });

  it("an unclassifiable mood rejects with `unclear` (a wrong galaxy is permanent)", async () => {
    const d = deps({ detectMood: vi.fn(async () => null) });
    const result = await proposeMemory("a memory the model cannot place", d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("unclear");
  });
});

describe("commitMemory (persist the confirmed proposal)", () => {
  it("inserts the confirmed star exactly once and returns the saved row", async () => {
    const star: MemoryStar = {
      id: "u-1",
      text: "the blue door",
      mood: "wistful",
      color: MOODS.wistful.color,
      r: 0.5,
      angle: 1.9,
      brightness: 0.7,
      createdAt: 1748100000000,
      group: "wistful",
      trigger: "action",
      placement: { tier: "galaxy", parentId: "triangulum", r: 0.5, angle: 1.9 },
    };
    const insert = vi.fn<(s: MemoryStar) => Promise<MemoryStar>>(
      async (s) => s,
    );
    const result = await commitMemory(star, { insert });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(star);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.star).toBe(star);
  });
});
