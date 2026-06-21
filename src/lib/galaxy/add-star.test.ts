import { describe, expect, it } from "vitest";
import { deriveMemoryStar } from "#/lib/galaxy/add-star";
import {
  hostGalaxyFor,
  MOOD_VALUES,
  MOODS,
  placeStar,
} from "#/lib/galaxy/seed";

describe("deriveMemoryStar", () => {
  it("derives color from the mood (MOODS[mood].color) — the AI never sets color", () => {
    for (const mood of MOOD_VALUES) {
      const star = deriveMemoryStar({
        id: "u-1",
        text: "a memory",
        mood,
        createdAt: 1748100000000,
      });
      expect(star.color).toBe(MOODS[mood].color);
    }
  });

  it("derives {r, angle} from placeStar(id, mood) — the append-only placement", () => {
    const star = deriveMemoryStar({
      id: "abc",
      text: "a memory",
      mood: "wistful",
      createdAt: 1,
    });
    const { r, angle } = placeStar("abc", "wistful");
    expect(star.r).toBe(r);
    expect(star.angle).toBe(angle);
  });

  it("carries the handler-supplied id, text and createdAt straight through", () => {
    const star = deriveMemoryStar({
      id: "id-xyz",
      text: "the memory text",
      mood: "joyful",
      createdAt: 1748123456789,
    });
    expect(star.id).toBe("id-xyz");
    expect(star.text).toBe("the memory text");
    expect(star.createdAt).toBe(1748123456789);
  });

  it("derives a brightness in (0..1) that is deterministic per id (SSR-safe)", () => {
    const a = deriveMemoryStar({
      id: "b1",
      text: "m",
      mood: "tender",
      createdAt: 1,
    });
    const b = deriveMemoryStar({
      id: "b1",
      text: "m",
      mood: "tender",
      createdAt: 2,
    });
    expect(a.brightness).toBeGreaterThan(0);
    expect(a.brightness).toBeLessThan(1);
    // Same id → same brightness (no module-scope random; pure of createdAt).
    expect(a.brightness).toBe(b.brightness);
  });

  it("never produces egg/deep (authored-only fields the AI cannot set)", () => {
    const star = deriveMemoryStar({
      id: "u-1",
      text: "a memory",
      mood: "wonder",
      createdAt: 1,
    });
    expect("egg" in star).toBe(false);
    expect("deep" in star).toBe(false);
  });

  it("only the mood crosses in — the produced star's mood is exactly the input mood", () => {
    const star = deriveMemoryStar({
      id: "u-1",
      text: "a memory",
      mood: "grieving",
      createdAt: 1,
    });
    expect(star.mood).toBe("grieving");
  });

  // ── #219 AC1: emotion → galaxy routing + figure group + trigger ───────────────
  it("routes the star to its emotion's host galaxy (placement.parentId = hostGalaxyFor)", () => {
    const cases: Array<[(typeof MOOD_VALUES)[number], string]> = [
      ["joyful", "home"],
      ["wonder", "andromeda"],
      ["peaceful", "triangulum"],
      ["courage", "lmc"],
    ];
    for (const [mood, galaxy] of cases) {
      const star = deriveMemoryStar({
        id: "u-1",
        text: "m",
        mood,
        createdAt: 1,
      });
      expect(star.placement?.tier).toBe("galaxy");
      expect(star.placement?.parentId).toBe(galaxy);
      expect(star.placement?.parentId).toBe(hostGalaxyFor(mood));
    }
  });

  it("mirrors the star's own (r, angle) into its placement (galaxy-tier view)", () => {
    const star = deriveMemoryStar({
      id: "abc",
      text: "m",
      mood: "wistful",
      createdAt: 1,
    });
    expect(star.placement?.r).toBe(star.r);
    expect(star.placement?.angle).toBe(star.angle);
  });

  it("derives the figure group from the emotion (one figure-group key per emotion)", () => {
    for (const mood of MOOD_VALUES) {
      const star = deriveMemoryStar({
        id: "u-1",
        text: "m",
        mood,
        createdAt: 1,
      });
      expect(star.group).toBe(mood);
    }
  });

  it("persists a captured trigger; omits the field entirely when none is given", () => {
    const withTrigger = deriveMemoryStar({
      id: "u-1",
      text: "m",
      mood: "tender",
      createdAt: 1,
      trigger: "person",
    });
    expect(withTrigger.trigger).toBe("person");

    const without = deriveMemoryStar({
      id: "u-2",
      text: "m",
      mood: "tender",
      createdAt: 1,
    });
    expect("trigger" in without).toBe(false);
  });
});
