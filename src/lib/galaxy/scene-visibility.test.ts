/**
 * Tests for §2 — interiorLayersVisible (AC2.1, ADR-0018 §2).
 * Single source of truth for "do the L3/L4/L5 MW-interior layers paint at
 * this displayed tier?"
 */

import { describe, expect, it } from "vitest";
import { interiorLayersVisible } from "#/lib/galaxy/scene-visibility";
import type { Tier } from "#/lib/galaxy/types";

describe("interiorLayersVisible — single source of truth for MW-interior layer visibility (AC2.1)", () => {
  it("returns true only for the galaxy tier (the MW interior IS the galaxy tier)", () => {
    expect(interiorLayersVisible("galaxy")).toBe(true);
  });

  it("returns false for the localGroup tier (interior hides on the LG overview)", () => {
    expect(interiorLayersVisible("localGroup")).toBe(false);
  });

  it("returns false for the solarSystem tier (interior hides on the solar-system floor)", () => {
    expect(interiorLayersVisible("solarSystem")).toBe(false);
  });

  it("an ascend sequence (galaxy → localGroup) never shows interior layers at a non-galaxy tier", () => {
    // Simulate the displayed-tier sequence during an ascend:
    // the threshold commits localGroup before arrive fires.
    const tiers: Tier[] = ["galaxy", "localGroup", "localGroup"];
    const visibilities = tiers.map(interiorLayersVisible);
    // Once we cross into localGroup, interior must be gone
    expect(visibilities[0]).toBe(true); // galaxy tier — visible
    expect(visibilities[1]).toBe(false); // localGroup threshold — hidden
    expect(visibilities[2]).toBe(false); // localGroup arrive — still hidden
  });

  it("a descend sequence (localGroup → galaxy) shows interior layers only after threshold", () => {
    const tiers: Tier[] = ["localGroup", "galaxy", "galaxy"];
    const visibilities = tiers.map(interiorLayersVisible);
    expect(visibilities[0]).toBe(false); // localGroup — hidden
    expect(visibilities[1]).toBe(true); // galaxy threshold — now visible
    expect(visibilities[2]).toBe(true); // galaxy arrive — still visible
  });

  it("no tier causes both localGroup-composition and MW-interior to paint simultaneously", () => {
    // Exhaustive: all tiers; none can be both LG-composition AND interior at once.
    // By definition: interiorLayersVisible(t) === true only for "galaxy",
    // and LG-composition is active at "localGroup". These never overlap.
    const allTiers: Tier[] = ["localGroup", "galaxy", "solarSystem"];
    const interiorVisible = allTiers.filter(interiorLayersVisible);
    expect(interiorVisible).toEqual(["galaxy"]);
    // The interior is visible at EXACTLY ONE tier — "galaxy".
    expect(interiorVisible).toHaveLength(1);
  });
});
