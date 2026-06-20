import { describe, expect, it } from "vitest";
import {
  ascendTier,
  availableTiersFor,
  descendTier,
  HOME_TIER,
  initialTierNav,
  type TierNavState,
  tierNavReducer,
  V1_AVAILABLE_TIERS,
} from "#/lib/galaxy/tier-nav";
import type { Tier } from "#/lib/galaxy/types";

// v1 ladder = localGroup + galaxy (solarSystem deferred to #127). A "full" ladder
// proves the reducer extends without edits when #127 adds the Solar-System tier.
const FULL: readonly Tier[] = ["localGroup", "galaxy", "solarSystem"];

describe("tierNavReducer", () => {
  it("lands on the Local-Group overview with no focus (owner decision 2026-06-06, overriding spec §1's MW-home)", () => {
    expect(HOME_TIER).toBe("localGroup");
    expect(initialTierNav).toEqual({
      tier: HOME_TIER,
      focusedId: null,
      galaxyId: null,
    });
  });

  it("ascend zooms out one available tier (galaxy → localGroup)", () => {
    const next = tierNavReducer(
      { tier: "galaxy", focusedId: "home", galaxyId: "home" },
      { type: "ascend" },
    );
    expect(next).toEqual({
      tier: "localGroup",
      focusedId: null,
      galaxyId: null,
    });
  });

  it("ascend at the widest tier is a clamp (same reference → soft bounce)", () => {
    const state: TierNavState = {
      tier: "localGroup",
      focusedId: null,
      galaxyId: null,
    };
    expect(tierNavReducer(state, { type: "ascend" })).toBe(state);
  });

  it("descend zooms in one available tier (localGroup → galaxy)", () => {
    const next = tierNavReducer(
      { tier: "localGroup", focusedId: null, galaxyId: null },
      { type: "descend" },
    );
    expect(next).toEqual({
      tier: "galaxy",
      focusedId: null,
      galaxyId: null,
    });
  });

  it("descend at the deepest v1 tier clamps (solarSystem deferred)", () => {
    const state: TierNavState = {
      tier: "galaxy",
      focusedId: null,
      galaxyId: null,
    };
    expect(tierNavReducer(state, { type: "descend" })).toBe(state);
  });

  it("descend reaches solarSystem once it is available (#127 extensibility)", () => {
    const next = tierNavReducer(
      { tier: "galaxy", focusedId: null, galaxyId: "home" },
      { type: "descend" },
      FULL,
    );
    expect(next).toEqual({
      tier: "solarSystem",
      focusedId: null,
      galaxyId: "home",
    });
  });

  it("diveTo centres on the gateway in the target tier", () => {
    const next = tierNavReducer(
      { tier: "localGroup", focusedId: null, galaxyId: null },
      { type: "diveTo", id: "home", tier: "galaxy" },
    );
    expect(next).toEqual({
      tier: "galaxy",
      focusedId: "home",
      galaxyId: "home",
    });
  });

  it("diveTo an unavailable tier is a clamp (Sol → solarSystem in v1)", () => {
    const state: TierNavState = {
      tier: "galaxy",
      focusedId: null,
      galaxyId: "home",
    };
    expect(
      tierNavReducer(state, { type: "diveTo", id: "sol", tier: "solarSystem" }),
    ).toBe(state);
  });

  it("descendTier / ascendTier return null at the v1 ends", () => {
    expect(descendTier("galaxy")).toBeNull();
    expect(ascendTier("localGroup")).toBeNull();
    expect(descendTier("galaxy", FULL)).toBe("solarSystem");
  });
});

describe("availableTiersFor — the per-galaxy asymmetric tier set (BR22)", () => {
  it("gives the home Milky Way all 3 tiers (it is the only galaxy with a Solar System)", () => {
    expect(availableTiersFor("home")).toEqual([
      "localGroup",
      "galaxy",
      "solarSystem",
    ]);
  });

  it("gives every neighbour galaxy only 2 tiers (no Solar System inside a neighbour)", () => {
    for (const id of ["andromeda", "lmc", "triangulum"]) {
      expect(availableTiersFor(id)).toEqual(["localGroup", "galaxy"]);
    }
  });

  it("treats an unknown / non-home id like a neighbour (2 tiers — defensive default)", () => {
    expect(availableTiersFor("nope")).toEqual(["localGroup", "galaxy"]);
  });

  it("keeps V1_AVAILABLE_TIERS as the 2-tier fallback default (callers without a focused galaxy)", () => {
    expect(V1_AVAILABLE_TIERS).toEqual(["localGroup", "galaxy"]);
  });
});

describe("tierNavReducer — galaxyId lifecycle (BR22, set/carry/clear)", () => {
  it("SETS galaxyId on diveTo into a neighbour galaxy (localGroup → galaxy)", () => {
    const next = tierNavReducer(
      { tier: "localGroup", focusedId: null, galaxyId: null },
      { type: "diveTo", id: "andromeda", tier: "galaxy" },
    );
    expect(next).toEqual({
      tier: "galaxy",
      focusedId: "andromeda",
      galaxyId: "andromeda",
    });
  });

  it("does NOT set galaxyId when diveTo targets a non-galaxy tier (e.g. solarSystem)", () => {
    // Diving Sol into the Solar System keeps the entered galaxy (home), not Sol's id.
    const next = tierNavReducer(
      { tier: "galaxy", focusedId: "home", galaxyId: "home" },
      { type: "diveTo", id: "sol", tier: "solarSystem" },
      availableTiersFor("home"),
    );
    expect(next).toEqual({
      tier: "solarSystem",
      focusedId: "sol",
      galaxyId: "home",
    });
  });

  it("CARRIES galaxyId through descend galaxy → solarSystem (MW only)", () => {
    const inGalaxy = tierNavReducer(
      { tier: "localGroup", focusedId: null, galaxyId: null },
      { type: "diveTo", id: "home", tier: "galaxy" },
    );
    const inSystem = tierNavReducer(
      inGalaxy,
      { type: "descend" },
      availableTiersFor("home"),
    );
    expect(inSystem).toEqual({
      tier: "solarSystem",
      focusedId: null,
      galaxyId: "home",
    });
  });

  it("CLEARS galaxyId on ascend back to the localGroup overview", () => {
    const inGalaxy: TierNavState = {
      tier: "galaxy",
      focusedId: "andromeda",
      galaxyId: "andromeda",
    };
    const back = tierNavReducer(inGalaxy, { type: "ascend" });
    expect(back).toEqual({
      tier: "localGroup",
      focusedId: null,
      galaxyId: null,
    });
  });

  it("keeps galaxyId while ascending solarSystem → galaxy (still inside the MW)", () => {
    const inSystem: TierNavState = {
      tier: "solarSystem",
      focusedId: null,
      galaxyId: "home",
    };
    const back = tierNavReducer(
      inSystem,
      { type: "ascend" },
      availableTiersFor("home"),
    );
    expect(back).toEqual({
      tier: "galaxy",
      focusedId: null,
      galaxyId: "home",
    });
  });

  it("full neighbour round-trip: dive Andromeda → ascend clears it", () => {
    let state: TierNavState = initialTierNav;
    state = tierNavReducer(state, {
      type: "diveTo",
      id: "andromeda",
      tier: "galaxy",
    });
    expect(state.galaxyId).toBe("andromeda");
    // a neighbour has no solarSystem tier → descend clamps (no-op)
    expect(
      tierNavReducer(
        state,
        { type: "descend" },
        availableTiersFor("andromeda"),
      ),
    ).toBe(state);
    state = tierNavReducer(state, { type: "ascend" });
    expect(state.galaxyId).toBeNull();
    expect(state.tier).toBe("localGroup");
  });
});
