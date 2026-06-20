import { describe, expect, it } from "vitest";
import { resolveClick } from "#/lib/galaxy/click-router";
import { HOME_MILKY_WAY_ID, REAL_OBJECTS, SOL_ID } from "#/lib/galaxy/realdata";
import { availableTiersFor } from "#/lib/galaxy/tier-nav";
import type { RealObject, Tier } from "#/lib/galaxy/types";

const FULL: readonly Tier[] = ["localGroup", "galaxy", "solarSystem"];
const byId = (id: string) =>
  REAL_OBJECTS.find((o) => o.id === id) as RealObject;

const memoryStar = {
  id: "s01",
  text: "the kitchen radio.",
  mood: "joyful",
  color: "#ffd166",
  r: 0.3,
  angle: 1,
  brightness: 0.8,
  createdAt: 1,
} as const;

describe("resolveClick", () => {
  it("a gateway whose child tier is available dives into it (Milky Way → galaxy)", () => {
    expect(resolveClick(byId(HOME_MILKY_WAY_ID))).toEqual({
      kind: "dive",
      id: "home",
      tier: "galaxy",
    });
  });

  it("Sol is a gateway but its tier (solarSystem) is deferred → lore card in v1", () => {
    expect(resolveClick(byId(SOL_ID))).toEqual({
      kind: "card",
      target: byId(SOL_ID),
    });
  });

  it("Sol dives once solarSystem is available (#127)", () => {
    expect(resolveClick(byId(SOL_ID), FULL)).toEqual({
      kind: "dive",
      id: "sol",
      tier: "solarSystem",
    });
  });

  it("each neighbour galaxy is now a gateway — dives into its (galaxy) tier (BR22)", () => {
    for (const id of ["andromeda", "lmc", "triangulum"]) {
      expect(resolveClick(byId(id), availableTiersFor(id))).toEqual({
        kind: "dive",
        id,
        tier: "galaxy",
      });
    }
  });

  it("the Milky Way still dives with its own available set (regression)", () => {
    expect(
      resolveClick(byId(HOME_MILKY_WAY_ID), availableTiersFor("home")),
    ).toEqual({
      kind: "dive",
      id: "home",
      tier: "galaxy",
    });
  });

  it("a neighbour never exposes the solarSystem tier — Sol-style dive stays a galaxy dive", () => {
    // availableTiersFor('andromeda') excludes solarSystem, so even though andromeda
    // is a gateway the deepest it dives to is its galaxy tier.
    expect(availableTiersFor("andromeda")).not.toContain("solarSystem");
  });

  it("an interior feature (nebula) opens a lore card", () => {
    expect(resolveClick(byId("pillars"))).toEqual({
      kind: "card",
      target: byId("pillars"),
    });
  });

  it("a memory star opens a memory card", () => {
    expect(resolveClick(memoryStar)).toEqual({
      kind: "card",
      target: memoryStar,
    });
  });
});
