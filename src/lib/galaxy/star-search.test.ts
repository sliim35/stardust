import { describe, expect, it } from "vitest";
import { searchStars } from "#/lib/galaxy/star-search";
import type { MemoryStar } from "#/lib/galaxy/types";

const make = (
  over: Partial<MemoryStar> & Pick<MemoryStar, "id">,
): MemoryStar => ({
  text: "a quiet memory.",
  mood: "peaceful",
  color: "#abcdef",
  r: 0.3,
  angle: 1,
  brightness: 0.8,
  createdAt: 1,
  ...over,
});

const STARS: readonly MemoryStar[] = [
  make({
    id: "s01",
    text: "dad dancing in the kitchen",
    mood: "joyful",
    color: "#ffd166",
  }),
  make({
    id: "s02",
    text: "grandfather's steady hands",
    mood: "tender",
    color: "#e76f51",
  }),
  make({
    id: "s03",
    text: "the voicemail I can't delete",
    mood: "grieving",
    color: "#5a6ea0",
  }),
  make({
    id: "irina",
    text: "for the one who taught me to look up",
    mood: "wonder",
    color: "#f5d6a0",
    name: "for mom",
  }),
];

describe("searchStars — pure substring index over text/mood/color", () => {
  it("matches on the memory text (case-insensitive substring)", () => {
    const hits = searchStars(STARS, "KITCHEN");
    expect(hits.map((s) => s.id)).toEqual(["s01"]);
  });

  it("matches on the mood key", () => {
    const hits = searchStars(STARS, "grieving");
    expect(hits.map((s) => s.id)).toEqual(["s03"]);
  });

  it("matches on the color hex (with or without the leading #)", () => {
    expect(searchStars(STARS, "#ffd166").map((s) => s.id)).toEqual(["s01"]);
    expect(searchStars(STARS, "FFD166").map((s) => s.id)).toEqual(["s01"]);
  });

  it("matches on the optional name", () => {
    expect(searchStars(STARS, "mom").map((s) => s.id)).toEqual(["irina"]);
  });

  it("an empty / whitespace query returns every star (the full index)", () => {
    expect(searchStars(STARS, "").map((s) => s.id)).toEqual([
      "s01",
      "s02",
      "s03",
      "irina",
    ]);
    expect(searchStars(STARS, "   ").map((s) => s.id)).toEqual([
      "s01",
      "s02",
      "s03",
      "irina",
    ]);
  });

  it("a query that matches nothing returns no results", () => {
    expect(searchStars(STARS, "zzzznope")).toEqual([]);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(searchStars(STARS, "  joyful  ").map((s) => s.id)).toEqual(["s01"]);
  });

  it("preserves the source order of the stars across a multi-hit query", () => {
    // "voicemail" → s03; "mom" → irina. A query hitting two non-adjacent stars
    // must come back in source order. Use a fixture pair with a shared token.
    const pair: readonly MemoryStar[] = [
      make({ id: "first", text: "shared token alpha" }),
      make({ id: "skip", text: "nothing here" }),
      make({ id: "second", text: "another shared line" }),
    ];
    expect(searchStars(pair, "shared").map((s) => s.id)).toEqual([
      "first",
      "second",
    ]);
  });
});
