import { describe, expect, it } from "vitest";
import { resolveClick } from "#/lib/galaxy/click-router";
import { HOME_MILKY_WAY_ID, REAL_OBJECTS, SOL_ID } from "#/lib/galaxy/realdata";
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

  it("a non-gateway neighbour opens a lore card", () => {
    expect(resolveClick(byId("andromeda"))).toEqual({
      kind: "card",
      target: byId("andromeda"),
    });
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
