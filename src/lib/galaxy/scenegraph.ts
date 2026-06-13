/**
 * The 3-tier universe scene graph (ADR-0008). Scenery —
 * `LocalGroup → GalaxyNode → SolarSystemNode → PlanetNode` — is **generated
 * deterministically from a seed and NEVER stored**; only Memory Stars are persisted.
 * The home galaxy is the tier-2 `home` node, reusing today's seeded sky verbatim.
 *
 * Every generator is a **pure function of a seed** and is **memoized**, so the same
 * input always returns the same (cached) graph — SSR and the client agree, and a
 * Cloudflare Worker never touches a module-scope `Math.random()` / `Date.now()`.
 * No new PRNG: reuses `mulberry32` / `hashStr` from `rng.ts` (#45 R1).
 *
 * Placement is **polar `(r, angle)`** — the same convention as today's stars, never
 * cartesian (ADR-0008 §2). Node screen positions convert polar→stage via `place.ts`,
 * exactly like stars.
 */

import {
  HOME_MILKY_WAY_ID,
  localGroupNeighbours,
  REAL_OBJECTS,
  realObjectsForView,
} from "#/lib/galaxy/realdata";
import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import { buildSeedSky } from "#/lib/galaxy/seed";
import type {
  GalaxyNode,
  LocalGroup,
  MemoryStar,
  PlanetNode,
  RealObject,
  SolarSystemNode,
  Sun,
  Tier,
} from "#/lib/galaxy/types";

/**
 * The id of the one curated, memory-bearing, descendable galaxy — today's seeded
 * sky (ADR-0008 §3) AND the real Milky Way in the dataset (ADR-0010). The scene
 * graph and `realdata.ts` share this id so the two layers register exactly.
 */
export const HOME_GALAXY_ID = HOME_MILKY_WAY_ID;

// The real-object selector is the data seam wave-2 rendering reads; re-export it
// here so callers reach scenery (real + procedural) through one module (ADR-0010 §4).
export { realObjectsForView };

// Counts per tier are intentionally small + fixed (KISS); tune visually later (#112).
// (The Local Group is no longer counted — it's the REAL set: home + 3 neighbours.)
const SYSTEMS_PER_GALAXY = 5;
const PLANETS_PER_SYSTEM = 4;

// A palette of procedural scenery colors (planets / suns). Decorative, not mood-derived.
const SCENERY_COLORS = [
  "#9cc4e8",
  "#e8b89c",
  "#c0e8a8",
  "#d8a8e8",
  "#e8d49c",
  "#a8e8d8",
] as const;

/** Pick a stable color for a seed (no PRNG state needed — one draw). */
const colorFor = (seed: number): string =>
  SCENERY_COLORS[
    Math.floor(mulberry32(seed)() * SCENERY_COLORS.length) %
      SCENERY_COLORS.length
  ];

/**
 * Default home-galaxy stars to `placement: { tier:'galaxy', parentId:'home', r, angle }`,
 * mirroring each star's own polar coords (ADR-0008 §3). Never mutates the input.
 */
export const withHomePlacement = (star: MemoryStar): MemoryStar => ({
  ...star,
  placement: star.placement ?? {
    tier: "galaxy",
    parentId: HOME_GALAXY_ID,
    r: star.r,
    angle: star.angle,
  },
});

// ── tier 3: solar system (sun + planets) ───────────────────────────────────────
const solarSystemCache = new Map<string, SolarSystemNode>();

const planetsFor = (node: SolarSystemNode): PlanetNode[] => {
  const out: PlanetNode[] = [];
  for (let i = 0; i < PLANETS_PER_SYSTEM; i++) {
    const id = `${node.id}-p${i}`;
    const seed = hashStr(id);
    const rng = mulberry32(seed);
    out.push({
      id,
      seed,
      color: colorFor(seed),
      orbit: (i + 1) / (PLANETS_PER_SYSTEM + 1),
      placement: {
        tier: "solarSystem",
        parentId: node.id,
        r: 0.2 + rng() * 0.7,
        angle: rng() * Math.PI * 2,
      },
    });
  }
  return out;
};

/** Derive a solar system's sun + planets from its node. Pure + memoized by node id. */
export const buildSolarSystem = (node: SolarSystemNode): SolarSystemNode => {
  const cached = solarSystemCache.get(node.id);
  if (cached) return cached;
  const sun: Sun = {
    seed: node.seed,
    color: colorFor(node.seed),
    radius: 0.5 + mulberry32(node.seed ^ 0x51)() * 0.4,
  };
  const built: SolarSystemNode = { ...node, sun, planets: planetsFor(node) };
  solarSystemCache.set(node.id, built);
  return built;
};

// ── tier 2: galaxy (black hole + solar systems) ────────────────────────────────
const galaxyCache = new Map<string, GalaxyNode>();

const solarSystemsFor = (node: GalaxyNode): SolarSystemNode[] => {
  const out: SolarSystemNode[] = [];
  for (let i = 0; i < SYSTEMS_PER_GALAXY; i++) {
    const id = `${node.id}-sys${i}`;
    const seed = hashStr(id);
    const rng = mulberry32(seed);
    out.push({
      id,
      seed,
      sun: { seed, color: colorFor(seed), radius: 0.5 },
      planets: [],
      placement: {
        tier: "galaxy",
        parentId: node.id,
        r: 0.25 + rng() * 0.65,
        angle: rng() * Math.PI * 2,
      },
    });
  }
  return out;
};

/** Derive a galaxy's black hole + solar systems from its node. Pure + memoized by id. */
export const buildGalaxy = (node: GalaxyNode): GalaxyNode => {
  const cached = galaxyCache.get(node.id);
  if (cached) return cached;
  const built: GalaxyNode = {
    ...node,
    blackHole: {
      seed: node.seed,
      radius: 0.4 + mulberry32(node.seed ^ 0xb0)() * 0.3,
    },
    solarSystems: solarSystemsFor(node),
  };
  galaxyCache.set(node.id, built);
  return built;
};

// ── tier 1: local group (galaxies, one is `home`) ──────────────────────────────
const localGroupCache = new Map<number, LocalGroup>();

const homeGalaxyNode = (placement: GalaxyNode["placement"]): GalaxyNode => {
  const sky = buildSeedSky();
  const seed = hashStr(HOME_GALAXY_ID);
  return {
    id: HOME_GALAXY_ID,
    seed,
    backdrop: sky.backdrop,
    blackHole: { seed, radius: 0.5 },
    stars: sky.stars.map(withHomePlacement),
    solarSystems: [],
    placement,
  };
};

/**
 * Adapt one real Local-Group neighbour (`realdata.ts`) into the `GalaxyNode` shape
 * the renderer + store already consume (ADR-0010 §4 — the adapter that flips the
 * scenery source PRNG→data). The real object owns the *position* (`placement`) +
 * identity; the node's scene-graph-only fields (`seed`/`backdrop`/`blackHole`) are
 * derived deterministically from the id via the SHARED `mulberry32`/`hashStr` (no
 * new PRNG, #45 R1). Neighbours are Layer-A scenery — memory-empty (`stars: []`).
 * The galaxy's real morphology (`arms`/`barAngle`/`tilt`) is read for rendering via
 * `realObjectsForView`; the node keeps the existing shape unchanged.
 */
const realNeighbourNode = (real: RealObject): GalaxyNode => {
  const seed = hashStr(real.id);
  const rng = mulberry32(seed);
  return {
    id: real.id,
    seed,
    backdrop: {
      seed,
      branches: real.arms ?? 2 + Math.floor(rng() * 4),
      spin: rng() < 0.5 ? 1 : -1,
      randomnessPower: 2.2,
      palette: "ice",
    },
    blackHole: { seed, radius: 0.4 + rng() * 0.3 },
    stars: [],
    solarSystems: [],
    placement: {
      tier: "localGroup",
      r: real.placement.r,
      angle: real.placement.angle,
    },
  };
};

/**
 * Derive the local group. Pure + memoized: the home galaxy is the curated seeded
 * sky (Layer B lives here), and the neighbours are now the REAL Local Group read
 * from `realdata.ts` (ADR-0010) — the home Milky Way + exactly the 3 named
 * neighbours (LMC, M31, M33). The procedural `g1…g6` decoys are dropped.
 */
export const buildLocalGroup = (seed: number): LocalGroup => {
  const cached = localGroupCache.get(seed);
  if (cached) return cached;
  // The home Milky Way's authored placement (centered) comes from the dataset too,
  // so Layer A owns every Local-Group position (no seed-randomized home anymore).
  const home = REAL_OBJECTS.find((o) => o.id === HOME_MILKY_WAY_ID)
    ?.placement ?? {
    r: 0,
    angle: 0,
  };
  const galaxies: GalaxyNode[] = [
    homeGalaxyNode({ tier: "localGroup", r: home.r, angle: home.angle }),
    ...localGroupNeighbours().map(realNeighbourNode),
  ];
  const built: LocalGroup = { seed, galaxies };
  localGroupCache.set(seed, built);
  return built;
};

/**
 * The home galaxy is the Local Group's **focused/`home` tier-2 node** (ADR-0008 §3,
 * #126 AC2): the one curated, memory-bearing galaxy you land on when you enter the
 * group. A pure selector over the (memoized) group — returns the exact node held by
 * the group, so callers reuse its derived scenery + live stars without re-deriving.
 * Throws if the group has no home node, since that violates the build invariant
 * (`buildLocalGroup` always seats exactly one).
 */
export const homeGalaxyOf = (localGroup: LocalGroup): GalaxyNode => {
  const home = localGroup.galaxies.find((g) => g.id === HOME_GALAXY_ID);
  if (!home)
    throw new Error(`Local Group is missing its "${HOME_GALAXY_ID}" galaxy`);
  return home;
};

/**
 * Filter Memory Stars to one tier+parent view (ADR-0008 §5). A star without an
 * explicit `placement` is treated as the home galaxy (`tier:'galaxy', parentId:'home'`)
 * — the back-compat default for today's flat seeded stars.
 */
export const starsForView = (
  stars: readonly MemoryStar[],
  tier: Tier,
  parentId?: string,
): MemoryStar[] =>
  stars.filter((s) => {
    const p = s.placement ?? {
      tier: "galaxy" as const,
      parentId: HOME_GALAXY_ID,
    };
    return p.tier === tier && p.parentId === parentId;
  });
