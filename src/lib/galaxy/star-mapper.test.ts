import { describe, expect, it } from "vitest";
import type { MemoryStarRow } from "#/lib/galaxy/star-mapper";
import { rowToMemoryStar } from "#/lib/galaxy/star-mapper";

/** A full, non-NULL row — every optional column populated. */
const fullRow = (over: Partial<MemoryStarRow> = {}): MemoryStarRow => ({
  id: "u-1",
  text: "a memory",
  name: "title",
  mood: "joyful",
  color: "#f3c24e",
  r: 0.5,
  angle: 1.2,
  brightness: 0.7,
  grp: "bright-days",
  who: "marco",
  tier: "galaxy",
  parentId: "home",
  placementR: 0.5,
  placementAngle: 1.2,
  createdAt: 1748000000000,
  ...over,
});

describe("rowToMemoryStar", () => {
  it("maps the required columns straight through", () => {
    const star = rowToMemoryStar(fullRow());
    expect(star.id).toBe("u-1");
    expect(star.text).toBe("a memory");
    expect(star.mood).toBe("joyful");
    expect(star.color).toBe("#f3c24e");
    expect(star.r).toBe(0.5);
    expect(star.angle).toBe(1.2);
    expect(star.brightness).toBe(0.7);
    expect(star.createdAt).toBe(1748000000000);
  });

  it("renames grp → group", () => {
    const star = rowToMemoryStar(fullRow({ grp: "quiet-ache" }));
    expect(star.group).toBe("quiet-ache");
    expect("grp" in star).toBe(false);
  });

  it("folds the placement quartet into placement? when all four are present", () => {
    const star = rowToMemoryStar(
      fullRow({
        tier: "solarSystem",
        parentId: "sys-x",
        placementR: 0.3,
        placementAngle: 2.1,
      }),
    );
    expect(star.placement).toEqual({
      tier: "solarSystem",
      parentId: "sys-x",
      r: 0.3,
      angle: 2.1,
    });
  });

  it("omits placement entirely when the quartet is NULL (legacy home default)", () => {
    const star = rowToMemoryStar(
      fullRow({
        tier: null,
        parentId: null,
        placementR: null,
        placementAngle: null,
      }),
    );
    expect("placement" in star).toBe(false);
  });

  it("a present placement with a NULL parent_id keeps parentId absent (parentId is itself optional)", () => {
    // parent_id is absent at the local-group tier.
    const star = rowToMemoryStar(
      fullRow({
        tier: "localGroup",
        parentId: null,
        placementR: 0.1,
        placementAngle: 0.2,
      }),
    );
    expect(star.placement?.tier).toBe("localGroup");
    expect(star.placement && "parentId" in star.placement).toBe(false);
  });

  it("every NULL column becomes an ABSENT field (never null)", () => {
    const star = rowToMemoryStar(
      fullRow({
        name: null,
        grp: null,
        who: null,
        tier: null,
        parentId: null,
        placementR: null,
        placementAngle: null,
      }),
    );
    expect("name" in star).toBe(false);
    expect("group" in star).toBe(false);
    expect("who" in star).toBe(false);
    expect("placement" in star).toBe(false);
  });

  it("never sets egg/deep (no user star is an egg/deep star)", () => {
    const star = rowToMemoryStar(fullRow());
    expect("egg" in star).toBe(false);
    expect("deep" in star).toBe(false);
  });
});
