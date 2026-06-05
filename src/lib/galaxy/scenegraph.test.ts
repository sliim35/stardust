import { describe, expect, it } from "vitest";
import {
  buildGalaxy,
  buildLocalGroup,
  buildSolarSystem,
  HOME_GALAXY_ID,
  starsForView,
} from "#/lib/galaxy/scenegraph";
import { buildSeedSky } from "#/lib/galaxy/seed";
import type { MemoryStar, Placement } from "#/lib/galaxy/types";

const UNIVERSE_SEED = 7777;

describe("buildLocalGroup", () => {
  it("is seed-deterministic — same seed yields an identical graph", () => {
    expect(buildLocalGroup(UNIVERSE_SEED)).toEqual(
      buildLocalGroup(UNIVERSE_SEED),
    );
  });

  it("memoizes — the same seed returns the same object reference", () => {
    expect(buildLocalGroup(UNIVERSE_SEED)).toBe(buildLocalGroup(UNIVERSE_SEED));
  });

  it("different seeds yield different graphs", () => {
    expect(buildLocalGroup(UNIVERSE_SEED)).not.toEqual(buildLocalGroup(1234));
  });

  it("carries the seed and a non-empty list of galaxies", () => {
    const lg = buildLocalGroup(UNIVERSE_SEED);
    expect(lg.seed).toBe(UNIVERSE_SEED);
    expect(lg.galaxies.length).toBeGreaterThan(0);
  });

  it("includes exactly one home galaxy at the home id", () => {
    const homes = buildLocalGroup(UNIVERSE_SEED).galaxies.filter(
      (g) => g.id === HOME_GALAXY_ID,
    );
    expect(homes).toHaveLength(1);
  });

  it("gives every galaxy a unique, stable id and a polar placement", () => {
    const galaxies = buildLocalGroup(UNIVERSE_SEED).galaxies;
    const ids = galaxies.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of galaxies) {
      expect(g.placement.tier).toBe("localGroup");
      expect(g.placement.r).toBeGreaterThanOrEqual(0);
      expect(g.placement.r).toBeLessThanOrEqual(1);
      expect(Number.isFinite(g.placement.angle)).toBe(true);
    }
  });

  it("reuses the seeded home sky verbatim as the home galaxy's backdrop + stars", () => {
    const home = buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id === HOME_GALAXY_ID,
    );
    const sky = buildSeedSky();
    expect(home?.backdrop).toEqual(sky.backdrop);
    // every seeded memory star is present on the home galaxy, by id
    const homeStarIds = new Set(home?.stars.map((s) => s.id));
    for (const s of sky.stars) expect(homeStarIds.has(s.id)).toBe(true);
  });

  it("defaults home-galaxy stars to placement { tier:'galaxy', parentId:'home' }", () => {
    const home = buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id === HOME_GALAXY_ID,
    );
    for (const s of home?.stars ?? []) {
      expect(s.placement?.tier).toBe("galaxy");
      expect(s.placement?.parentId).toBe(HOME_GALAXY_ID);
      // placement mirrors the star's own polar coords
      expect(s.placement?.r).toBe(s.r);
      expect(s.placement?.angle).toBe(s.angle);
    }
  });
});

describe("buildGalaxy", () => {
  it("is deterministic for a given node (same node → identical galaxy)", () => {
    const node = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    expect(buildGalaxy(node)).toEqual(buildGalaxy(node));
  });

  it("memoizes per node — repeated calls return the same reference", () => {
    const node = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    expect(buildGalaxy(node)).toBe(buildGalaxy(node));
  });

  it("derives a black-hole core and at least one solar system", () => {
    const node = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    const galaxy = buildGalaxy(node);
    expect(galaxy.blackHole).toBeDefined();
    expect(galaxy.solarSystems.length).toBeGreaterThan(0);
  });

  it("gives each solar system a unique id and a polar placement parented to the galaxy", () => {
    const node = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    const galaxy = buildGalaxy(node);
    const ids = galaxy.solarSystems.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of galaxy.solarSystems) {
      expect(s.placement.tier).toBe("galaxy");
      expect(s.placement.parentId).toBe(node.id);
      expect(s.placement.r).toBeGreaterThanOrEqual(0);
      expect(s.placement.r).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildSolarSystem", () => {
  it("is deterministic for a given node", () => {
    const galaxyNode = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    const sysNode = buildGalaxy(galaxyNode).solarSystems[0];
    expect(buildSolarSystem(sysNode)).toEqual(buildSolarSystem(sysNode));
  });

  it("memoizes per node", () => {
    const galaxyNode = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    const sysNode = buildGalaxy(galaxyNode).solarSystems[0];
    expect(buildSolarSystem(sysNode)).toBe(buildSolarSystem(sysNode));
  });

  it("derives a sun and at least one planet", () => {
    const galaxyNode = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    const sysNode = buildGalaxy(galaxyNode).solarSystems[0];
    const sys = buildSolarSystem(sysNode);
    expect(sys.sun).toBeDefined();
    expect(sys.planets.length).toBeGreaterThan(0);
  });

  it("gives each planet a unique id, a color, and a polar placement parented to the system", () => {
    const galaxyNode = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    const sysNode = buildGalaxy(galaxyNode).solarSystems[0];
    const planets = buildSolarSystem(sysNode).planets;
    const ids = planets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of planets) {
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.placement.tier).toBe("solarSystem");
      expect(p.placement.parentId).toBe(sysNode.id);
    }
  });
});

describe("starsForView", () => {
  const star = (id: string, placement: Placement): MemoryStar => ({
    id,
    text: id,
    mood: "wonder",
    color: "#abcdef",
    r: placement.r,
    angle: placement.angle,
    brightness: 0.7,
    createdAt: 1,
    placement,
  });

  const stars: MemoryStar[] = [
    star("home-1", { tier: "galaxy", parentId: "home", r: 0.3, angle: 0.1 }),
    star("home-2", { tier: "galaxy", parentId: "home", r: 0.6, angle: 1.2 }),
    star("other", { tier: "galaxy", parentId: "g2", r: 0.4, angle: 0.5 }),
    star("lg-1", { tier: "localGroup", r: 0.2, angle: 2 }),
    star("sys-1", { tier: "solarSystem", parentId: "sys-a", r: 0.5, angle: 3 }),
  ];

  it("filters stars by tier + parentId", () => {
    const got = starsForView(stars, "galaxy", "home").map((s) => s.id);
    expect(got.sort()).toEqual(["home-1", "home-2"]);
  });

  it("filters a different parent in the same tier independently", () => {
    expect(starsForView(stars, "galaxy", "g2").map((s) => s.id)).toEqual([
      "other",
    ]);
  });

  it("matches a tier-1 (localGroup) view with no parentId", () => {
    expect(starsForView(stars, "localGroup").map((s) => s.id)).toEqual([
      "lg-1",
    ]);
  });

  it("matches a solar-system view by parent", () => {
    expect(
      starsForView(stars, "solarSystem", "sys-a").map((s) => s.id),
    ).toEqual(["sys-1"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(starsForView(stars, "galaxy", "nope")).toEqual([]);
  });

  it("treats a star without placement as the home galaxy (back-compat default)", () => {
    const legacy: MemoryStar = {
      id: "legacy",
      text: "no placement",
      mood: "wonder",
      color: "#fff000",
      r: 0.5,
      angle: 1,
      brightness: 0.5,
      createdAt: 1,
    };
    const got = starsForView([legacy], "galaxy", "home").map((s) => s.id);
    expect(got).toEqual(["legacy"]);
  });
});
