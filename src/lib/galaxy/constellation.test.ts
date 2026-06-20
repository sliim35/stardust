import { describe, expect, it } from "vitest";
import {
  assignAnchors,
  figureColor,
  figureForGroup,
  figureSegments,
  figureState,
  ghostSegments,
  hoverAffordanceFor,
  slotBeyondCompletion,
} from "#/lib/galaxy/constellation";
import { polarToXY } from "#/lib/galaxy/place";
import { MOODS } from "#/lib/galaxy/seed";
import type {
  ConstellationFigure,
  FigureAnchor,
  MemoryStar,
  RealObject,
} from "#/lib/galaxy/types";

const mkStar = (over: Partial<MemoryStar> & { id: string }): MemoryStar => ({
  text: "t",
  mood: "wistful",
  color: "#b8c4e0",
  r: 0.5,
  angle: 1,
  brightness: 0.7,
  createdAt: 0,
  ...over,
});

// A tiny 3-anchor figure for the unit tests (the real ≥10 silhouettes are a
// design-role deliverable; these fixtures exercise the pure helpers only).
const ANCHORS: readonly FigureAnchor[] = [
  { id: "n1", r: 0.2, angle: 0.5 },
  { id: "n2", r: 0.6, angle: 1.5 },
  { id: "n3", r: 0.9, angle: 2.5 },
];

const mkFigure = (
  over?: Partial<ConstellationFigure>,
): ConstellationFigure => ({
  group: "g",
  emotion: "wistful",
  hostGalaxyId: "triangulum",
  threshold: 3,
  anchors: ANCHORS,
  edges: [
    ["n1", "n2"],
    ["n2", "n3"],
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

describe("assignAnchors — stable createdAt-order, append-only binding", () => {
  it("binds members to anchors by ascending createdAt (anchorId → star)", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 300 });
    const b = mkStar({ id: "b", group: "g", createdAt: 100 });
    const c = mkStar({ id: "c", group: "g", createdAt: 200 });
    // Input order is shuffled — binding follows createdAt, not array order.
    const bound = assignAnchors([a, b, c], ANCHORS);
    expect(bound.get("n1")?.id).toBe("b"); // earliest
    expect(bound.get("n2")?.id).toBe("c");
    expect(bound.get("n3")?.id).toBe("a"); // latest
  });

  it("partial fill: fewer members than anchors leaves later anchors open", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 100 });
    const b = mkStar({ id: "b", group: "g", createdAt: 200 });
    const bound = assignAnchors([a, b], ANCHORS);
    expect(bound.size).toBe(2);
    expect(bound.get("n1")?.id).toBe("a");
    expect(bound.get("n2")?.id).toBe("b");
    expect(bound.has("n3")).toBe(false);
  });

  it("exact threshold: every anchor is filled", () => {
    const stars = [
      mkStar({ id: "a", group: "g", createdAt: 1 }),
      mkStar({ id: "b", group: "g", createdAt: 2 }),
      mkStar({ id: "c", group: "g", createdAt: 3 }),
    ];
    const bound = assignAnchors(stars, ANCHORS);
    expect(bound.size).toBe(ANCHORS.length);
  });

  it("append-only: adding a later member never moves an earlier binding", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 100 });
    const b = mkStar({ id: "b", group: "g", createdAt: 200 });
    const before = assignAnchors([a, b], ANCHORS);
    const c = mkStar({ id: "c", group: "g", createdAt: 300 });
    const after = assignAnchors([a, b, c], ANCHORS);
    // The earlier two bindings are unchanged; only the new open anchor fills.
    expect(after.get("n1")?.id).toBe(before.get("n1")?.id);
    expect(after.get("n2")?.id).toBe(before.get("n2")?.id);
    expect(after.get("n3")?.id).toBe("c");
  });

  it("ties on createdAt break by id so the order is total + stable", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 5 });
    const b = mkStar({ id: "b", group: "g", createdAt: 5 });
    const bound = assignAnchors([b, a], ANCHORS);
    expect(bound.get("n1")?.id).toBe("a");
    expect(bound.get("n2")?.id).toBe("b");
  });
});

describe("figureState — derived forming/finished (never stored)", () => {
  it("is 'forming' below the threshold", () => {
    const members = [
      mkStar({ id: "a", createdAt: 1 }),
      mkStar({ id: "b", createdAt: 2 }),
    ];
    expect(figureState(members, mkFigure({ threshold: 3 }))).toBe("forming");
  });

  it("is 'finished' at the exact threshold boundary", () => {
    const members = [
      mkStar({ id: "a", createdAt: 1 }),
      mkStar({ id: "b", createdAt: 2 }),
      mkStar({ id: "c", createdAt: 3 }),
    ];
    expect(figureState(members, mkFigure({ threshold: 3 }))).toBe("finished");
  });

  it("is 'finished' beyond the threshold", () => {
    const members = Array.from({ length: 5 }, (_, i) =>
      mkStar({ id: `m${i}`, createdAt: i }),
    );
    expect(figureState(members, mkFigure({ threshold: 3 }))).toBe("finished");
  });
});

describe("figureSegments — only edges whose BOTH anchors are filled", () => {
  it("draws an edge at the bound members' anchor positions, in order", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 1 });
    const b = mkStar({ id: "b", group: "g", createdAt: 2 });
    const c = mkStar({ id: "c", group: "g", createdAt: 3 });
    const segs = figureSegments([a, b, c], mkFigure());
    expect(segs).toHaveLength(2);
    // n1→n2 and n2→n3 at the AUTHORED anchor positions (not the star's own r/angle).
    expect(segs[0]).toEqual({
      from: polarToXY(ANCHORS[0].r, ANCHORS[0].angle),
      to: polarToXY(ANCHORS[1].r, ANCHORS[1].angle),
    });
    expect(segs[1]).toEqual({
      from: polarToXY(ANCHORS[1].r, ANCHORS[1].angle),
      to: polarToXY(ANCHORS[2].r, ANCHORS[2].angle),
    });
  });

  it("omits an edge whose endpoint anchor has no bound member yet (forming)", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 1 });
    const b = mkStar({ id: "b", group: "g", createdAt: 2 });
    // Only n1, n2 filled → edge n2→n3 is dropped (n3 empty).
    const segs = figureSegments([a, b], mkFigure());
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({
      from: polarToXY(ANCHORS[0].r, ANCHORS[0].angle),
      to: polarToXY(ANCHORS[1].r, ANCHORS[1].angle),
    });
  });

  it("excludes a cross-emotion member (#154 rule 1 retained)", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 1 });
    const intruder = mkStar({
      id: "b",
      group: "g",
      mood: "joyful",
      createdAt: 2,
    });
    const c = mkStar({ id: "c", group: "g", createdAt: 3 });
    // The intruder is removed BEFORE binding, so a/c bind to n1/n2; edge n2→n3
    // (n3 empty) drops → only n1→n2 remains.
    const segs = figureSegments([a, intruder, c], mkFigure());
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({
      from: polarToXY(ANCHORS[0].r, ANCHORS[0].angle),
      to: polarToXY(ANCHORS[1].r, ANCHORS[1].angle),
    });
  });

  it("NEVER binds a deep star — Mom's star stays a lone point (#154 hard rule)", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 1 });
    const moms = mkStar({ id: "b", group: "g", deep: true, createdAt: 2 });
    // Only `a` survives → no edge has both endpoints filled → nothing drawn.
    expect(figureSegments([a, moms], mkFigure())).toEqual([]);
  });

  it("a figure with no members draws nothing", () => {
    expect(figureSegments([], mkFigure())).toEqual([]);
  });
});

describe("ghostSegments — the full silhouette outline, regardless of fill", () => {
  it("draws ALL authored anchor edges at authored positions even with no members", () => {
    const segs = ghostSegments(mkFigure());
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({
      from: polarToXY(ANCHORS[0].r, ANCHORS[0].angle),
      to: polarToXY(ANCHORS[1].r, ANCHORS[1].angle),
    });
    expect(segs[1]).toEqual({
      from: polarToXY(ANCHORS[1].r, ANCHORS[1].angle),
      to: polarToXY(ANCHORS[2].r, ANCHORS[2].angle),
    });
  });

  it("is independent of how many members exist (it is the figure's geometry)", () => {
    const a = mkFigure();
    expect(ghostSegments(a)).toEqual(ghostSegments(a));
    expect(ghostSegments(a)).toHaveLength(a.edges.length);
  });

  it("drops an edge that references an undeclared anchor (defensive)", () => {
    const broken = mkFigure({
      edges: [
        ["n1", "n2"],
        ["n2", "nope"],
      ],
    });
    expect(ghostSegments(broken)).toHaveLength(1);
  });
});

describe("slotBeyondCompletion — SSR-safe, deterministic edge-midpoint densification", () => {
  const EDGES: readonly (readonly [string, string])[] = [
    ["n1", "n2"],
    ["n2", "n3"],
  ];

  it("is deterministic — same inputs → same output", () => {
    const a = slotBeyondCompletion("mem-x", ANCHORS, EDGES, 0);
    const b = slotBeyondCompletion("mem-x", ANCHORS, EDGES, 0);
    expect(a).toEqual(b);
  });

  it("different memberId → different output (no visual stacking)", () => {
    const a = slotBeyondCompletion("mem-x", ANCHORS, EDGES, 0);
    const b = slotBeyondCompletion("mem-y", ANCHORS, EDGES, 0);
    expect(a).not.toEqual(b);
  });

  it("lands near an edge midpoint (within the ±0.05 perturbation envelope)", () => {
    const pos = slotBeyondCompletion("mem-x", ANCHORS, EDGES, 0);
    // priorBeyondCount 0 → the first beyond-member takes the least-occupied edge
    // (index 0 by tie-break): midpoint of n1/n2.
    const midR = (ANCHORS[0].r + ANCHORS[1].r) / 2;
    const midAngle = (ANCHORS[0].angle + ANCHORS[1].angle) / 2;
    expect(Math.abs(pos.r - midR)).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(Math.abs(pos.angle - midAngle)).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it("distributes across edges as priorBeyondCount grows (least-occupied first)", () => {
    const first = slotBeyondCompletion("m1", ANCHORS, EDGES, 0);
    const second = slotBeyondCompletion("m2", ANCHORS, EDGES, 1);
    // With 2 edges, the 2nd beyond-member targets the OTHER edge's midpoint.
    const mid0 = {
      r: (ANCHORS[0].r + ANCHORS[1].r) / 2,
      angle: (ANCHORS[0].angle + ANCHORS[1].angle) / 2,
    };
    const mid1 = {
      r: (ANCHORS[1].r + ANCHORS[2].r) / 2,
      angle: (ANCHORS[1].angle + ANCHORS[2].angle) / 2,
    };
    expect(Math.abs(first.r - mid0.r)).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(Math.abs(second.r - mid1.r)).toBeLessThanOrEqual(0.05 + 1e-9);
  });
});

describe("figureColor — single colour by construction (rule 2), via emotion", () => {
  it("is exactly the figure's emotion colour from MOODS", () => {
    expect(figureColor(mkFigure({ emotion: "joyful" }))).toBe(
      MOODS.joyful.color,
    );
    expect(figureColor(mkFigure({ emotion: "wistful" }))).toBe(
      MOODS.wistful.color,
    );
  });

  it("resolves a NEW (12-emotion) colour token", () => {
    expect(figureColor(mkFigure({ emotion: "courage" }))).toBe(
      MOODS.courage.color,
    );
  });
});

describe("figureForGroup — a star's group key resolves to its authored figure", () => {
  it("an unknown group resolves to null (CONSTELLATIONS is empty post-retirement)", () => {
    expect(figureForGroup("no-such-figure")).toBeNull();
  });
});

describe("hoverAffordanceFor — what hover lights (interaction spec §3)", () => {
  it("a grouped memory star gets short-desc + its constellation group", () => {
    const star = mkStar({ id: "s", group: "g" });
    expect(hoverAffordanceFor(star)).toEqual({ kind: "memory", group: "g" });
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
