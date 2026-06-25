import { describe, expect, it } from "vitest";
import {
  HOME_MILKY_WAY_ID,
  localGroupNeighbours,
  SOL_SYSTEM_ID,
  SOL_SYSTEM_STAR_ID,
} from "#/lib/galaxy/realdata";
import {
  buildGalaxy,
  buildLocalGroup,
  buildSolarSystem,
  HOME_GALAXY_ID,
  homeGalaxyOf,
  realObjectsForView,
  solarSystemObjects,
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

  it("seats the seeded Irina memory star on the home galaxy (#126 AC3)", () => {
    const home = buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id === HOME_GALAXY_ID,
    );
    const byId = new Map((home?.stars ?? []).map((s) => [s.id, s]));
    // Mom's lone gold star must live on home, with a home placement.
    for (const id of ["irina"]) {
      const s = byId.get(id);
      expect(
        s,
        `seeded star "${id}" should live on the home galaxy`,
      ).toBeDefined();
      expect(s?.placement?.tier).toBe("galaxy");
      expect(s?.placement?.parentId).toBe(HOME_GALAXY_ID);
    }
  });

  // ── ADR-0010: the Local Group is now the REAL Local Group (no procedural g#) ──
  it("seats the home galaxy plus EXACTLY the 3 real neighbours (no more)", () => {
    const galaxies = buildLocalGroup(UNIVERSE_SEED).galaxies;
    expect(galaxies).toHaveLength(1 + localGroupNeighbours().length);
    expect(localGroupNeighbours()).toHaveLength(3);
  });

  it("drops every procedural g# galaxy (zero g1…g6 ids)", () => {
    const ids = buildLocalGroup(UNIVERSE_SEED).galaxies.map((g) => g.id);
    for (const id of ids) expect(id).not.toMatch(/^g\d+$/);
  });

  it("includes exactly the real neighbour ids (LMC, M31, M33) beside home", () => {
    const ids = buildLocalGroup(UNIVERSE_SEED)
      .galaxies.map((g) => g.id)
      .filter((id) => id !== HOME_GALAXY_ID);
    expect(ids.sort()).toEqual(["andromeda", "lmc", "triangulum"]);
  });

  it("uses the SAME home id in the scene graph and the real dataset", () => {
    expect(HOME_GALAXY_ID).toBe(HOME_MILKY_WAY_ID);
    expect(
      buildLocalGroup(UNIVERSE_SEED).galaxies.some(
        (g) => g.id === HOME_MILKY_WAY_ID,
      ),
    ).toBe(true);
  });

  it("carries each real neighbour's curated placement onto its GalaxyNode", () => {
    const galaxies = buildLocalGroup(UNIVERSE_SEED).galaxies;
    for (const real of localGroupNeighbours()) {
      const node = galaxies.find((g) => g.id === real.id);
      expect(node, `node for ${real.id}`).toBeDefined();
      expect(node?.placement.tier).toBe("localGroup");
      expect(node?.placement.r).toBe(real.placement.r);
      expect(node?.placement.angle).toBe(real.placement.angle);
    }
  });

  it("keeps the real neighbours memory-empty (Layer A is not memories)", () => {
    const galaxies = buildLocalGroup(UNIVERSE_SEED).galaxies;
    for (const real of localGroupNeighbours()) {
      const node = galaxies.find((g) => g.id === real.id);
      expect(node?.stars).toEqual([]);
    }
  });
});

describe("realObjectsForView (re-exported selector for wave-2 rendering)", () => {
  it("re-exports the realdata selector — localGroup view = home + 3 neighbours", () => {
    const ids = realObjectsForView("localGroup").map((o) => o.id);
    expect(ids.sort()).toEqual(
      ["andromeda", "lmc", "triangulum", HOME_MILKY_WAY_ID].sort(),
    );
  });

  it("returns the Milky-Way interior real objects for (galaxy, home)", () => {
    const ids = realObjectsForView("galaxy", HOME_GALAXY_ID).map((o) => o.id);
    expect(ids.sort()).toEqual(
      ["crab", "orion", "orionArm", "pillars", "sgra", "sol"].sort(),
    );
  });
});

describe("homeGalaxyOf (#126 — home is the Local Group's focused/home node)", () => {
  it("resolves the home GalaxyNode from a Local Group", () => {
    const lg = buildLocalGroup(UNIVERSE_SEED);
    expect(homeGalaxyOf(lg).id).toBe(HOME_GALAXY_ID);
  });

  it("returns the exact home node held by the group (not a copy)", () => {
    const lg = buildLocalGroup(UNIVERSE_SEED);
    const direct = lg.galaxies.find((g) => g.id === HOME_GALAXY_ID);
    expect(homeGalaxyOf(lg)).toBe(direct);
  });

  it("carries the seeded sky as its backdrop + stars (the tier-2 home projection)", () => {
    const home = homeGalaxyOf(buildLocalGroup(UNIVERSE_SEED));
    const sky = buildSeedSky();
    expect(home.backdrop).toEqual(sky.backdrop);
    const ids = new Set(home.stars.map((s) => s.id));
    for (const s of sky.stars) expect(ids.has(s.id)).toBe(true);
  });

  it("throws if a group somehow has no home galaxy (invariant guard)", () => {
    const lg = buildLocalGroup(UNIVERSE_SEED);
    const homeless = {
      ...lg,
      galaxies: lg.galaxies.filter((g) => g.id !== HOME_GALAXY_ID),
    };
    expect(() => homeGalaxyOf(homeless)).toThrow();
  });
});

describe("buildGalaxy", () => {
  const homeNode = () =>
    buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id === HOME_GALAXY_ID,
    );
  const neighbourNode = () =>
    buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id !== HOME_GALAXY_ID,
    );

  it("is deterministic for a given node (same node → identical galaxy)", () => {
    const node = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    expect(buildGalaxy(node)).toEqual(buildGalaxy(node));
  });

  it("memoizes per node — repeated calls return the same reference", () => {
    const node = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    expect(buildGalaxy(node)).toBe(buildGalaxy(node));
  });

  it("derives a black-hole core for every galaxy", () => {
    const node = buildLocalGroup(UNIVERSE_SEED).galaxies[0];
    expect(buildGalaxy(node).blackHole).toBeDefined();
  });

  it("seats EXACTLY the one real Sol system on the home Milky Way (ADR-0016 §1)", () => {
    const home = homeNode();
    expect(home).toBeDefined();
    if (!home) return;
    const galaxy = buildGalaxy(home);
    expect(galaxy.solarSystems).toHaveLength(1);
    const sys = galaxy.solarSystems[0];
    expect(sys.id).toBe(SOL_SYSTEM_ID);
    expect(sys.placement.tier).toBe("galaxy");
    expect(sys.placement.parentId).toBe(home.id);
  });

  it("gives neighbour galaxies NO solar systems (asymmetric tiers — only home descends)", () => {
    const neighbour = neighbourNode();
    expect(neighbour).toBeDefined();
    if (!neighbour) return;
    expect(buildGalaxy(neighbour).solarSystems).toEqual([]);
  });
});

describe("buildSolarSystem — the real-data adapter (ADR-0016 §1, AC5)", () => {
  it("is pure + memoized — same call yields the identical container", () => {
    expect(buildSolarSystem(HOME_GALAXY_ID)).toBe(
      buildSolarSystem(HOME_GALAXY_ID),
    );
    expect(buildSolarSystem(HOME_GALAXY_ID)).toEqual(
      buildSolarSystem(HOME_GALAXY_ID),
    );
  });

  it("carries the real Sol + 8 planets as bodies (NOT procedural PRNG planets)", () => {
    const sys = buildSolarSystem(HOME_GALAXY_ID);
    expect(sys.id).toBe(SOL_SYSTEM_ID);
    expect(sys.bodies).toEqual(solarSystemObjects());
    expect(sys.bodies).toHaveLength(9); // Sol + 8 planets
  });

  it("its bodies are exactly the curated tier-3 set: Sol + the 8 planets", () => {
    const ids = buildSolarSystem(HOME_GALAXY_ID).bodies.map((b) => b.id);
    expect(ids.sort()).toEqual(
      [
        SOL_SYSTEM_STAR_ID,
        "mercury",
        "venus",
        "earth",
        "mars",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
      ].sort(),
    );
  });

  it("every body is a curated real object at the solarSystem tier (Layer A)", () => {
    for (const b of buildSolarSystem(HOME_GALAXY_ID).bodies) {
      expect(b.tier).toBe("solarSystem");
      expect(b.parentId).toBe(SOL_SYSTEM_ID);
      expect(b.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ── BR33/ADR-0016 §6 — NO Memory Stars at tier 3 (structural pin, AC7) ─────────
describe("no memory stars at the Solar-System tier (BR33, ADR-0016 §6)", () => {
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

  it("starsForView(.., 'solarSystem', SOL_SYSTEM_ID) is empty for the whole seeded corpus", () => {
    const seeded = buildSeedSky().stars;
    expect(starsForView(seeded, "solarSystem", SOL_SYSTEM_ID)).toEqual([]);
    // …and for the live home node (the only galaxy that descends to tier 3).
    const home = homeGalaxyOf(buildLocalGroup(UNIVERSE_SEED));
    expect(starsForView(home.stars, "solarSystem", SOL_SYSTEM_ID)).toEqual([]);
  });

  it("the tier-3 object set is exactly Sol + 8 planets, all star|planet, none a gateway", () => {
    const bodies = realObjectsForView("solarSystem", SOL_SYSTEM_ID);
    expect(bodies).toHaveLength(9);
    for (const b of bodies) {
      expect(["star", "planet"]).toContain(b.kind);
      // none descends further (no Earth tier — planets are the deepest objects).
      expect(b.gateway).not.toBe(true);
    }
  });

  it("never adopts a stray tier-3 star even if one is authored (the filter is structural)", () => {
    // A hypothetical mis-placed memory star at tier 3 must NOT leak into the
    // no-memory view — the invariant is enforced by the filter, not by the data
    // happening to be empty. starsForView keys on placement, so a tier-3 star
    // would only ever match a tier-3 query (which the renderer never mounts).
    const seeded = buildSeedSky().stars;
    const strayId = "stray-tier3";
    const withStray = [
      ...seeded,
      star(strayId, {
        tier: "solarSystem",
        parentId: SOL_SYSTEM_ID,
        r: 0.5,
        angle: 1,
      }),
    ];
    // The galaxy-tier view (what tier 2 actually mounts) never picks it up…
    expect(
      starsForView(withStray, "galaxy", HOME_GALAXY_ID).some(
        (s) => s.id === strayId,
      ),
    ).toBe(false);
    // …and the seeded corpus authors NO tier-3 star in the first place.
    expect(seeded.some((s) => s.placement?.tier === "solarSystem")).toBe(false);
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
