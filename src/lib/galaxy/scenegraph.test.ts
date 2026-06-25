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

// Mom (irina) now lives at the solarSystem tier (owner 2026-06-25). This constant
// is used across the tests below to assert or exclude her where needed.
const MOM_ID = "irina";

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

  it("defaults home-galaxy stars to placement { tier:'galaxy', parentId:'home' } (except Mom)", () => {
    const home = buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id === HOME_GALAXY_ID,
    );
    // Mom (irina) lives at the solarSystem tier (owner 2026-06-25) — her explicit
    // placement is preserved by withHomePlacement's `??` guard. Every OTHER home star
    // gets defaulted to the galaxy tier.
    for (const s of home?.stars ?? []) {
      if (s.id === MOM_ID) {
        // Mom keeps her solar placement.
        expect(s.placement?.tier).toBe("solarSystem");
        expect(s.placement?.parentId).toBe(SOL_SYSTEM_ID);
      } else {
        expect(s.placement?.tier).toBe("galaxy");
        expect(s.placement?.parentId).toBe(HOME_GALAXY_ID);
        // placement mirrors the star's own polar coords
        expect(s.placement?.r).toBe(s.r);
        expect(s.placement?.angle).toBe(s.angle);
      }
    }
  });

  it("seats the seeded Irina memory star on the home galaxy — now at the solarSystem tier (owner 2026-06-25)", () => {
    const home = buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id === HOME_GALAXY_ID,
    );
    const byId = new Map((home?.stars ?? []).map((s) => [s.id, s]));
    // Mom's lone gold star IS still present on the home galaxy's star list (the store
    // merges all stars at this level), but her PLACEMENT is now solarSystem — "her home"
    // is Sol. `starsForView` routes her to the solar-tier view, not the MW interior.
    const irina = byId.get(MOM_ID);
    expect(
      irina,
      `seeded star "${MOM_ID}" should be in the home galaxy's list`,
    ).toBeDefined();
    expect(irina?.placement?.tier).toBe("solarSystem");
    expect(irina?.placement?.parentId).toBe(SOL_SYSTEM_ID);
  });

  it("starsForView('galaxy','home') does NOT include Mom — she lives in the Solar System now", () => {
    const home = buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id === HOME_GALAXY_ID,
    );
    const galaxyTierStars = starsForView(
      home?.stars ?? [],
      "galaxy",
      HOME_GALAXY_ID,
    );
    expect(galaxyTierStars.some((s) => s.id === MOM_ID)).toBe(false);
  });

  it("starsForView('solarSystem', SOL_SYSTEM_ID) includes Mom (her new home)", () => {
    const home = buildLocalGroup(UNIVERSE_SEED).galaxies.find(
      (g) => g.id === HOME_GALAXY_ID,
    );
    const solarStars = starsForView(
      home?.stars ?? [],
      "solarSystem",
      SOL_SYSTEM_ID,
    );
    expect(solarStars.some((s) => s.id === MOM_ID)).toBe(true);
    const mom = solarStars.find((s) => s.id === MOM_ID);
    expect(mom?.deep).toBe(true);
    expect(mom?.color).toBe("#f5d6a0"); // gold reservation preserved
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

// ── Memory Stars at the Solar-System tier (owner 2026-06-25: Mom moved here) ─────
// Mom (irina) is now the ONE intentional solarSystem-tier memory star. The BR33
// "no memory stars at tier 3" invariant is retired for Mom specifically — her
// dedicated gold star belongs at Sol ("her home"). User-added stars still default
// to the galaxy tier; only the seed's explicit placement routes her to tier 3.
describe("Mom's dedication star lives at the Solar-System tier (owner 2026-06-25)", () => {
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

  it("starsForView(.., 'solarSystem', SOL_SYSTEM_ID) returns ONLY Mom from the seeded corpus", () => {
    const seeded = buildSeedSky().stars;
    const solarStars = starsForView(seeded, "solarSystem", SOL_SYSTEM_ID);
    expect(solarStars).toHaveLength(1);
    expect(solarStars[0]?.id).toBe(MOM_ID);
    expect(solarStars[0]?.deep).toBe(true);
    // …and for the live home node.
    const home = homeGalaxyOf(buildLocalGroup(UNIVERSE_SEED));
    const homeSolarStars = starsForView(
      home.stars,
      "solarSystem",
      SOL_SYSTEM_ID,
    );
    expect(homeSolarStars).toHaveLength(1);
    expect(homeSolarStars[0]?.id).toBe(MOM_ID);
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

  it("starsForView filter is structural — a stray tier-3 star never leaks into the galaxy-tier view", () => {
    // The filter is structural: a stray mis-placed star only matches a tier-3 query.
    // The galaxy-tier render never sees it (it only queries 'galaxy' view).
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
    // …and only the stray (not Mom) is truly "stray" — Mom has an explicit placement.
    expect(
      seeded.some(
        (s) => s.placement?.tier === "solarSystem" && s.id !== MOM_ID,
      ),
    ).toBe(false);
  });

  it("Mom's solar placement r/angle are well clear of every planet orbit", () => {
    const mom = buildSeedSky().stars.find((s) => s.id === MOM_ID);
    expect(mom?.placement?.tier).toBe("solarSystem");
    // Mom is between Saturn (r≈0.755) and Uranus (r≈0.858) in the radial.
    expect(mom?.r).toBeGreaterThan(0.75);
    expect(mom?.r).toBeLessThan(0.9);
    // Her angle (≈250°) is between Neptune (≈216°) and Jupiter (≈284°) — the outer void.
    const angleDeg = ((mom?.angle ?? 0) * 180) / Math.PI;
    expect(angleDeg).toBeGreaterThan(215);
    expect(angleDeg).toBeLessThan(285);
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
