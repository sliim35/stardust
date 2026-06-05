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

import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import { buildSeedSky } from "#/lib/galaxy/seed";
import type {
  GalaxyNode,
  LocalGroup,
  MemoryStar,
  PlanetNode,
  SolarSystemNode,
  Sun,
  Tier,
} from "#/lib/galaxy/types";

/** The id of the one curated, memory-bearing galaxy — today's seeded sky (ADR-0008 §3). */
export const HOME_GALAXY_ID = "home";

// Counts per tier are intentionally small + fixed (KISS); tune visually later (#112).
const GALAXIES_PER_GROUP = 7;
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

const proceduralGalaxyNode = (i: number): GalaxyNode => {
  const id = `g${i}`;
  const seed = hashStr(id);
  const rng = mulberry32(seed);
  return {
    id,
    seed,
    backdrop: {
      seed,
      branches: 2 + Math.floor(rng() * 4),
      spin: rng() < 0.5 ? 1 : -1,
      randomnessPower: 2.2,
      palette: "ice",
    },
    blackHole: { seed, radius: 0.4 + rng() * 0.3 },
    stars: [],
    solarSystems: [],
    placement: {
      tier: "localGroup",
      r: 0.2 + rng() * 0.7,
      angle: rng() * Math.PI * 2,
    },
  };
};

/**
 * Derive the local group from the universe seed. Pure + memoized: the home galaxy
 * is the curated seeded sky; the rest are procedural + memory-empty (v1, ADR-0008 §3).
 */
export const buildLocalGroup = (seed: number): LocalGroup => {
  const cached = localGroupCache.get(seed);
  if (cached) return cached;
  const rng = mulberry32(seed);
  const galaxies: GalaxyNode[] = [
    homeGalaxyNode({
      tier: "localGroup",
      r: 0.2 + rng() * 0.5,
      angle: rng() * Math.PI * 2,
    }),
  ];
  for (let i = 1; i < GALAXIES_PER_GROUP; i++) {
    galaxies.push(proceduralGalaxyNode(i));
  }
  const built: LocalGroup = { seed, galaxies };
  localGroupCache.set(seed, built);
  return built;
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
