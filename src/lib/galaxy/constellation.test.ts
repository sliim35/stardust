import { describe, expect, it } from "vitest";
import {
  constellationNodes,
  constellationSegments,
  hoverAffordanceFor,
} from "#/lib/galaxy/constellation";
import { polarToXY } from "#/lib/galaxy/place";
import { buildSeedSky, CONSTELLATIONS } from "#/lib/galaxy/seed";
import type { MemoryStar, RealObject } from "#/lib/galaxy/types";

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

describe("constellationNodes — same-group membership in createdAt order", () => {
  it("orders same-group stars by createdAt regardless of input order", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 300 });
    const b = mkStar({ id: "b", group: "g", createdAt: 100 });
    const c = mkStar({ id: "c", group: "g", createdAt: 200 });
    const nodes = constellationNodes([a, b, c], "g");
    expect(nodes.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("skips ungrouped stars and stars of other groups", () => {
    const inGroup = mkStar({ id: "in", group: "g", createdAt: 1 });
    const other = mkStar({ id: "other", group: "h", createdAt: 2 });
    const loner = mkStar({ id: "loner", createdAt: 3 });
    const nodes = constellationNodes([inGroup, other, loner], "g");
    expect(nodes.map((n) => n.id)).toEqual(["in"]);
  });

  it("NEVER includes a deep star — even one wrongly carrying a group (owner hard constraint, 2026-06-06)", () => {
    const member = mkStar({ id: "m", group: "g", createdAt: 1 });
    const deepInGroup = mkStar({
      id: "moms",
      group: "g",
      deep: true,
      createdAt: 2,
    });
    const nodes = constellationNodes([member, deepInGroup], "g");
    expect(nodes.map((n) => n.id)).toEqual(["m"]);
  });

  it("Mom's star (irina, deep) and the egg are never nodes of any seed constellation", () => {
    const { stars } = buildSeedSky();
    const irina = stars.find((s) => s.deep === true);
    expect(irina).toBeDefined();
    // The seed keeps Mom's star ungrouped — and it must stay that way (ADR-0010 §1).
    expect(irina?.group).toBeUndefined();
    for (const group of Object.values(CONSTELLATIONS)) {
      const ids = constellationNodes(stars, group).map((n) => n.id);
      expect(ids).not.toContain(irina?.id);
      expect(ids).not.toContain("egg");
    }
  });
});

describe("constellationSegments — consecutive connect-lines", () => {
  it("connects N ordered nodes with N-1 segments at their polar positions", () => {
    const a = mkStar({ id: "a", group: "g", createdAt: 1, r: 0.2, angle: 0.5 });
    const b = mkStar({ id: "b", group: "g", createdAt: 2, r: 0.6, angle: 1.5 });
    const c = mkStar({ id: "c", group: "g", createdAt: 3, r: 0.9, angle: 2.5 });
    const segs = constellationSegments([a, b, c]);
    expect(segs).toHaveLength(2);
    expect(segs[0].from).toEqual(polarToXY(a.r, a.angle));
    expect(segs[0].to).toEqual(polarToXY(b.r, b.angle));
    expect(segs[1].from).toEqual(polarToXY(b.r, b.angle));
    expect(segs[1].to).toEqual(polarToXY(c.r, c.angle));
  });

  it("yields no segments for fewer than two nodes", () => {
    expect(constellationSegments([])).toEqual([]);
    expect(constellationSegments([mkStar({ id: "solo" })])).toEqual([]);
  });
});

describe("hoverAffordanceFor — what hover lights (interaction spec §3)", () => {
  it("a grouped memory star gets short-desc + its constellation", () => {
    const star = mkStar({ id: "s", group: CONSTELLATIONS.quietAche });
    expect(hoverAffordanceFor(star)).toEqual({
      kind: "memory",
      group: CONSTELLATIONS.quietAche,
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
