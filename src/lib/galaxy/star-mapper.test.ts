import { describe, expect, it } from "vitest";
import { hostGalaxyFor } from "#/lib/galaxy/seed";
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
  trigger: "person",
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

  it("routes a NULL-quartet (pre-migration) row via hostGalaxyFor(mood), mirroring the star's coords", () => {
    // A legacy row written before the placement quartet existed: rather than
    // leaving placement absent (which the renderer would force to 'home'), the
    // mapper synthesizes a galaxy-tier placement whose parentId is the emotion's
    // host galaxy — so the star lands in the right galaxy, not always home (AC3).
    const star = rowToMemoryStar(
      fullRow({
        mood: "joyful",
        r: 0.55,
        angle: 0.9,
        tier: null,
        parentId: null,
        placementR: null,
        placementAngle: null,
      }),
    );
    expect(star.placement).toEqual({
      tier: "galaxy",
      parentId: hostGalaxyFor("joyful"), // "home"
      r: 0.55,
      angle: 0.9,
    });
  });

  it("routes a NULL-parent_id row with mood:'wonder' to parentId:'andromeda' (AC4)", () => {
    const star = rowToMemoryStar(
      fullRow({
        mood: "wonder",
        tier: null,
        parentId: null,
        placementR: null,
        placementAngle: null,
      }),
    );
    expect(star.placement?.parentId).toBe("andromeda");
  });

  it("a PARTIALLY-NULL quartet (corrupt row) keeps placement ABSENT — never synthesizes from intrinsic coords", () => {
    // The synthesis branch is the genuine pre-migration case (the WHOLE quartet
    // is NULL). A partial-null quartet — tier NULL but a coord present, which
    // atomic writes shouldn't produce — is corrupt data; we must NOT silently
    // synthesize a galaxy placement from the star's intrinsic (r, angle).
    const tierNullCoordPresent = rowToMemoryStar(
      fullRow({
        mood: "wonder",
        tier: null,
        parentId: null,
        placementR: 0.4,
        placementAngle: 1.1,
      }),
    );
    expect(tierNullCoordPresent.placement).toBeUndefined();
    expect("placement" in tierNullCoordPresent).toBe(false);

    // The mirror corruption: tier present but a coord NULL.
    const tierPresentCoordNull = rowToMemoryStar(
      fullRow({
        tier: "galaxy",
        parentId: "home",
        placementR: null,
        placementAngle: 1.1,
      }),
    );
    expect(tierPresentCoordNull.placement).toBeUndefined();
    expect("placement" in tierPresentCoordNull).toBe(false);
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

  it("maps a non-NULL trigger straight through (round-trip)", () => {
    expect(rowToMemoryStar(fullRow({ trigger: "person" })).trigger).toBe(
      "person",
    );
    expect(rowToMemoryStar(fullRow({ trigger: "action" })).trigger).toBe(
      "action",
    );
  });

  it("maps a NULL trigger to an ABSENT field (back-compat — never null)", () => {
    const star = rowToMemoryStar(fullRow({ trigger: null }));
    expect(star.trigger).toBeUndefined();
    expect("trigger" in star).toBe(false);
  });

  it("every NULL optional column (except the mood-routed placement) becomes ABSENT (never null)", () => {
    const star = rowToMemoryStar(
      fullRow({
        name: null,
        grp: null,
        who: null,
        trigger: null,
        tier: null,
        parentId: null,
        placementR: null,
        placementAngle: null,
      }),
    );
    expect("name" in star).toBe(false);
    expect("group" in star).toBe(false);
    expect("who" in star).toBe(false);
    expect("trigger" in star).toBe(false);
  });

  it("never sets egg/deep (no user star is an egg/deep star)", () => {
    const star = rowToMemoryStar(fullRow());
    expect("egg" in star).toBe(false);
    expect("deep" in star).toBe(false);
  });
});
