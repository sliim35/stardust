import { describe, expect, it } from "vitest";
import {
  animSeed,
  bloomSizing,
  haloGradient,
  hoverLabelFor,
  MOOD_LABELS,
  starColor,
  twinkleParams,
} from "#/lib/galaxy/star-visual";
import type { MemoryStar } from "#/lib/galaxy/types";

const star = (over: Partial<MemoryStar> = {}): MemoryStar => ({
  id: "s01",
  text: "a memory",
  mood: "joyful",
  color: "#f0c987",
  r: 0.5,
  angle: 0.3,
  brightness: 0.5,
  createdAt: 0,
  ...over,
});

describe("bloomSizing", () => {
  it("derives the spec formula from brightness", () => {
    const s = bloomSizing(star({ brightness: 0.5 }));
    expect(s.bloom).toBeCloseTo(18.5, 6); // 13 + 0.5*11
    expect(s.flareW).toBeCloseTo(18.5 * 2.5, 6);
    expect(s.hot).toBeCloseTo(18.5 * 0.5, 6);
    expect(s.core).toBeCloseTo(3, 6); // max(2, 2 + 0.5*2)
  });

  it("blooms 1.3× when active (hovered/selected)", () => {
    expect(bloomSizing(star({ brightness: 0.5 }), true).bloom).toBeCloseTo(
      18.5 * 1.3,
      6,
    );
  });

  it("gives the egg a fixed bloom independent of brightness", () => {
    expect(bloomSizing(star({ egg: true, brightness: 0.1 })).bloom).toBe(15);
    expect(bloomSizing(star({ egg: true, brightness: 0.9 })).bloom).toBe(15);
  });

  it("blooms Mom's deep star biggest — boosted over a same-brightness plain star", () => {
    const deep = bloomSizing(star({ deep: true, brightness: 1 }));
    const plain = bloomSizing(star({ brightness: 1 }));
    expect(deep.bloom).toBeGreaterThan(plain.bloom);
    expect(deep.bloom).toBeCloseTo((13 + 11) * 1.25, 6); // 24 * 1.25 = 30
  });

  it("blooms the deep lodestar bigger than a dimmer regular star (b<1)", () => {
    const deep = bloomSizing(star({ deep: true, brightness: 1 }));
    const regular = bloomSizing(star({ brightness: 0.5 }));
    expect(deep.bloom).toBeGreaterThan(regular.bloom);
  });

  it("never lets the core pixel fall below 2px", () => {
    expect(bloomSizing(star({ brightness: 0 })).core).toBe(2);
    expect(bloomSizing(star({ brightness: 1 })).core).toBe(4);
  });
});

describe("animSeed (derived twinkle/phase — fields not in the data contract)", () => {
  it("is deterministic per star id", () => {
    expect(animSeed("s01")).toEqual(animSeed("s01"));
  });

  it("differs between ids", () => {
    expect(animSeed("s01")).not.toEqual(animSeed("s02"));
  });

  it("stays in range (phase 0..1, positive twinkle)", () => {
    const a = animSeed("whatever");
    expect(a.phase).toBeGreaterThanOrEqual(0);
    expect(a.phase).toBeLessThan(1);
    expect(a.twinkle).toBeGreaterThan(0);
  });
});

describe("twinkleParams", () => {
  it("uses the slow egg pulse for the egg", () => {
    expect(twinkleParams(star({ egg: true }))).toMatchObject({
      period: 5.5,
      kind: "egg",
    });
  });

  it("clamps the twinkle period to a calm minimum", () => {
    const t = twinkleParams(star());
    expect(t.kind).toBe("twinkle");
    expect(t.period).toBeGreaterThanOrEqual(1.4);
  });

  it("gives Mom's deep star a soft, slow pulse (not a busy twinkle)", () => {
    const t = twinkleParams(star({ deep: true }));
    expect(t.kind).toBe("deep");
    expect(t.period).toBeGreaterThan(3);
  });
});

describe("hoverLabelFor", () => {
  it("is null for the egg — it never shows a hover label", () => {
    expect(hoverLabelFor(star({ egg: true, name: "ignored" }))).toBeNull();
  });

  it("prefers the star name, falling back to the mood label", () => {
    expect(hoverLabelFor(star({ name: "kitchen radio" }))).toBe(
      "kitchen radio",
    );
    expect(hoverLabelFor(star({ name: undefined, mood: "grieving" }))).toBe(
      MOOD_LABELS.grieving,
    );
  });
});

describe("MOOD_LABELS fallback captions (#193-B AC5)", () => {
  it("frees `longing` from the wistful fallback — each owns its own word", () => {
    // PR #202 left both `wistful` and `longing` falling back to "longing"; the
    // #193-B rename gives `wistful` its own word so the two stop colliding.
    expect(MOOD_LABELS.wistful).toBe("wistful");
    expect(MOOD_LABELS.longing).toBe("longing");
    expect(MOOD_LABELS.wistful).not.toBe(MOOD_LABELS.longing);
  });

  it("keeps the other near-pair emotions on distinct fallback words", () => {
    expect(MOOD_LABELS.hope).not.toBe(MOOD_LABELS.wonder);
    expect(MOOD_LABELS.gratitude).not.toBe(MOOD_LABELS.tender);
  });
});

describe("color pass-through (agent-owned, never recolored)", () => {
  it("returns the star color verbatim", () => {
    expect(starColor(star({ color: "#abcdef" }))).toBe("#abcdef");
  });

  it("embeds the exact hex in the halo gradient", () => {
    expect(haloGradient("#abcdef")).toContain("#abcdef");
  });
});
