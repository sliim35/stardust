import { describe, expect, it } from "vitest";
import {
  ascendTier,
  descendTier,
  initialTierNav,
  type TierNavState,
  tierNavReducer,
} from "#/lib/galaxy/tier-nav";
import type { Tier } from "#/lib/galaxy/types";

// v1 ladder = localGroup + galaxy (solarSystem deferred to #127). A "full" ladder
// proves the reducer extends without edits when #127 adds the Solar-System tier.
const FULL: readonly Tier[] = ["localGroup", "galaxy", "solarSystem"];

describe("tierNavReducer", () => {
  it("lands on the home (galaxy) tier with no focus", () => {
    expect(initialTierNav).toEqual({ tier: "galaxy", focusedId: null });
  });

  it("ascend zooms out one available tier (galaxy → localGroup)", () => {
    const next = tierNavReducer(
      { tier: "galaxy", focusedId: "home" },
      { type: "ascend" },
    );
    expect(next).toEqual({ tier: "localGroup", focusedId: null });
  });

  it("ascend at the widest tier is a clamp (same reference → soft bounce)", () => {
    const state: TierNavState = { tier: "localGroup", focusedId: null };
    expect(tierNavReducer(state, { type: "ascend" })).toBe(state);
  });

  it("descend zooms in one available tier (localGroup → galaxy)", () => {
    const next = tierNavReducer(
      { tier: "localGroup", focusedId: null },
      { type: "descend" },
    );
    expect(next).toEqual({ tier: "galaxy", focusedId: null });
  });

  it("descend at the deepest v1 tier clamps (solarSystem deferred)", () => {
    const state: TierNavState = { tier: "galaxy", focusedId: null };
    expect(tierNavReducer(state, { type: "descend" })).toBe(state);
  });

  it("descend reaches solarSystem once it is available (#127 extensibility)", () => {
    const next = tierNavReducer(
      { tier: "galaxy", focusedId: null },
      { type: "descend" },
      FULL,
    );
    expect(next).toEqual({ tier: "solarSystem", focusedId: null });
  });

  it("diveTo centres on the gateway in the target tier", () => {
    const next = tierNavReducer(
      { tier: "localGroup", focusedId: null },
      { type: "diveTo", id: "home", tier: "galaxy" },
    );
    expect(next).toEqual({ tier: "galaxy", focusedId: "home" });
  });

  it("diveTo an unavailable tier is a clamp (Sol → solarSystem in v1)", () => {
    const state: TierNavState = { tier: "galaxy", focusedId: null };
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
