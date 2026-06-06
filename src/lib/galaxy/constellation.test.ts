import { describe, expect, it } from "vitest";
import {
  constellationNodes,
  constellationSegments,
  figureColor,
  figureForGroup,
  hoverAffordanceFor,
} from "#/lib/galaxy/constellation";
import { polarToXY } from "#/lib/galaxy/place";
import { buildSeedSky, CONSTELLATIONS, MOODS } from "#/lib/galaxy/seed";
import type {
  ConstellationFigure,
  MemoryStar,
  RealObject,
} from "#/lib/galaxy/types";

const mkStar = (over: Partial<MemoryStar> & { id: string }): MemoryStar => ({
  text: "t",
  mood: "wistful",
  color: "#c8d4e8",
  r: 0.5,
  angle: 1,
  brightness: 0.7,
  createdAt: 0,
  ...over,
});

const mkFigure = (
  over?: Partial<ConstellationFigure>,
): ConstellationFigure => ({
  group: "g",
  mood: "wistful",
  members: ["a", "b", "c"],
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
  ...over,
});

const mkReal = (): RealObject => ({
  id: "andromeda",
  kind: "galaxy",
  name: "Andromeda",
  tier: "localGroup",
  realDistance: { value: 2.5, unit: "Mly" },
  placement: { r: 0.8, angle: 2 },
  shape: "barred-spiral",
  size: 0.8,
  brightness: 0.7,
  color: "#9bb7e8",
  loreKey: "andromeda",
});

describe("constellationNodes — validated, mood-pure figure membership (rule 1)", () => {
  it("returns the figure's members in AUTHORED order — not createdAt order", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 300 });
    const b = mkStar({ id: "b", group: "g", createdAt: 100 });
    const c = mkStar({ id: "c", group: "g", createdAt: 200 });
    const nodes = constellationNodes([b, c, a], mkFigure());
    expect(nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("EXCLUDES a forged cross-mood member — same mood only (owner rule 1, 2026-06-06)", () => {
    const a = mkStar({ id: "a", group: "g" });
    const intruder = mkStar({ id: "b", group: "g", mood: "joyful" });
    const c = mkStar({ id: "c", group: "g" });
    const nodes = constellationNodes([a, intruder, c], mkFigure());
    expect(nodes.map((n) => n.id)).toEqual(["a", "c"]);
  });

  it("skips member ids that resolve to no star", () => {
    const a = mkStar({ id: "a", group: "g" });
    const nodes = constellationNodes([a], mkFigure());
    expect(nodes.map((n) => n.id)).toEqual(["a"]);
  });

  it("NEVER includes a deep star — even one wrongly authored into a figure (owner hard constraint, 2026-06-06)", () => {
    const a = mkStar({ id: "a", group: "g" });
    const moms = mkStar({ id: "b", group: "g", deep: true });
    const nodes = constellationNodes([a, moms], mkFigure());
    expect(nodes.map((n) => n.id)).toEqual(["a"]);
  });

  it("the shipped seed sky is mood-pure: every figure member resolves and shares the figure's mood", () => {
    const { stars } = buildSeedSky();
    for (const figure of Object.values(CONSTELLATIONS)) {
      const nodes = constellationNodes(stars, figure);
      // Nothing excluded — the real data satisfies rule 1 by authorship, and the
      // validation in the builder is a guard, never a silent data patch.
      expect(nodes.map((n) => n.id)).toEqual([...figure.members]);
      for (const node of nodes) expect(node.mood).toBe(figure.mood);
    }
  });

  it("Mom's star (irina, deep) and the egg are never nodes of any seed figure", () => {
    const { stars } = buildSeedSky();
    const irina = stars.find((s) => s.deep === true);
    expect(irina).toBeDefined();
    // The seed keeps Mom's star ungrouped — and it must stay that way (ADR-0010 §1).
    expect(irina?.group).toBeUndefined();
    for (const figure of Object.values(CONSTELLATIONS)) {
      const ids = constellationNodes(stars, figure).map((n) => n.id);
      expect(ids).not.toContain(irina?.id);
      expect(ids).not.toContain("egg");
      expect(figure.members).not.toContain(irina?.id);
    }
  });
});

describe("constellationSegments — authored edge topology (rule 3)", () => {
  it("draws exactly the authored edges, in order, at the nodes' polar positions", () => {
    const a = mkStar({ id: "a", group: "g", r: 0.2, angle: 0.5 });
    const b = mkStar({ id: "b", group: "g", r: 0.6, angle: 1.5 });
    const c = mkStar({ id: "c", group: "g", r: 0.9, angle: 2.5 });
    // A closed triangle: 3 nodes / 3 edges — a createdAt-chain builder (N-1
    // segments) could never produce this figure.
    const triangle = mkFigure({
      edges: [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ],
    });
    const segs = constellationSegments([a, b, c], triangle);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({
      from: polarToXY(a.r, a.angle),
      to: polarToXY(b.r, b.angle),
    });
    expect(segs[1]).toEqual({
      from: polarToXY(b.r, b.angle),
      to: polarToXY(c.r, c.angle),
    });
    expect(segs[2]).toEqual({
      from: polarToXY(c.r, c.angle),
      to: polarToXY(a.r, a.angle),
    });
  });

  it("drops an edge touching an excluded node (cross-mood / deep / missing)", () => {
    const a = mkStar({ id: "a", group: "g" });
    const intruder = mkStar({ id: "b", group: "g", mood: "joyful" });
    const c = mkStar({ id: "c", group: "g" });
    const figure = mkFigure({
      edges: [
        ["a", "b"],
        ["a", "c"],
      ],
    });
    const segs = constellationSegments([a, intruder, c], figure);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({
      from: polarToXY(a.r, a.angle),
      to: polarToXY(c.r, c.angle),
    });
  });

  it("a degenerate figure (fewer than two resolvable nodes) draws nothing", () => {
    const solo = mkStar({ id: "a", group: "g" });
    expect(constellationSegments([solo], mkFigure())).toEqual([]);
    expect(constellationSegments([], mkFigure())).toEqual([]);
  });

  it("the shipped brightDays figure is a closed triangle — NOT a chain (rule 3)", () => {
    const { stars } = buildSeedSky();
    const figure = CONSTELLATIONS.brightDays;
    const segs = constellationSegments(stars, figure);
    expect(segs).toHaveLength(figure.edges.length);
    // The authored topology has MORE edges than a chain over the same nodes —
    // the discriminator an emergent createdAt-chain could never satisfy.
    expect(figure.edges.length).toBeGreaterThan(figure.members.length - 1);
  });

  it("the shipped quietAche figure routes through its authored hub — not the createdAt chain", () => {
    const { stars } = buildSeedSky();
    const figure = CONSTELLATIONS.quietAche;
    const segs = constellationSegments(stars, figure);
    expect(segs).toHaveLength(figure.edges.length);
    // The chain over these nodes in createdAt order would link s04 first
    // (earliest seed star) — the authored arc instead places s04 as the hub.
    const chainEndpoints = constellationNodes(stars, figure)
      .slice()
      .sort((x, y) => x.createdAt - y.createdAt)
      .map((n) => n.id);
    expect(figure.edges.map(([from, to]) => `${from}-${to}`)).not.toEqual(
      chainEndpoints.slice(1).map((id, i) => `${chainEndpoints[i]}-${id}`),
    );
  });
});

describe("figureColor — single colour by construction (rule 2)", () => {
  it("is exactly the figure's mood colour from MOODS", () => {
    expect(figureColor(mkFigure({ mood: "joyful" }))).toBe(MOODS.joyful.color);
    expect(figureColor(mkFigure({ mood: "wistful" }))).toBe(
      MOODS.wistful.color,
    );
  });

  it("every shipped figure's segment endpoints share ONE colour === MOODS[figure.mood].color", () => {
    const { stars } = buildSeedSky();
    for (const figure of Object.values(CONSTELLATIONS)) {
      const nodes = constellationNodes(stars, figure);
      const colours = new Set(nodes.map((n) => n.color));
      expect(colours.size).toBe(1);
      expect([...colours][0]).toBe(figureColor(figure));
      expect(figureColor(figure)).toBe(MOODS[figure.mood].color);
    }
  });
});

describe("figureForGroup — a star's group key resolves to its authored figure", () => {
  it("resolves a shipped group key to its figure", () => {
    expect(figureForGroup(CONSTELLATIONS.quietAche.group)).toBe(
      CONSTELLATIONS.quietAche,
    );
    expect(figureForGroup(CONSTELLATIONS.brightDays.group)).toBe(
      CONSTELLATIONS.brightDays,
    );
  });

  it("an unknown group resolves to null", () => {
    expect(figureForGroup("no-such-figure")).toBeNull();
  });
});

describe("hoverAffordanceFor — what hover lights (interaction spec §3)", () => {
  it("a grouped memory star gets short-desc + its constellation", () => {
    const star = mkStar({ id: "s", group: CONSTELLATIONS.quietAche.group });
    expect(hoverAffordanceFor(star)).toEqual({
      kind: "memory",
      group: CONSTELLATIONS.quietAche.group,
    });
  });

  it("an ungrouped memory star gets short-desc only (no constellation)", () => {
    expect(hoverAffordanceFor(mkStar({ id: "loner" }))).toEqual({
      kind: "memory",
      group: null,
    });
  });

  it("a deep star gets short-desc only even if it carries a group (Mom's star is always a lone point)", () => {
    const moms = mkStar({ id: "moms", deep: true, group: "g" });
    expect(hoverAffordanceFor(moms)).toEqual({ kind: "memory", group: null });
  });

  it("a real object gets only the subtle clickable highlight — never a constellation", () => {
    expect(hoverAffordanceFor(mkReal())).toEqual({ kind: "real" });
  });
});
