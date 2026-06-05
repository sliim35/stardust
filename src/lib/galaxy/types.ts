/**
 * The Memory Galaxy data contract — shared by the canvas renderer (#4), the
 * store seam, and (later) the AI placement agent. Mirrors `docs/pixel-galaxy-ui.md`
 * §1, extended with the prototype's optional `name` / `who` / `deep` fields
 * (`stardust/project/memory-data.jsx`).
 *
 * The agent owns the stars; the UI owns the sky. Nothing in this layer recolors
 * or repositions a star — `color` and `(r, angle)` are passed through unchanged.
 * Render-only fields (twinkle, phase, camera) are NOT part of the contract; they
 * belong to the renderer (#4).
 */

export type Mood =
  | "joyful"
  | "tender"
  | "grieving"
  | "wistful"
  | "peaceful"
  | "nostalgic"
  | "wonder";

/** Backdrop sky tone. Default is `ember` (amber) — owner resolved amber-vs-green → amber (2026-06-04). */
export type Palette = "ember" | "ice" | "auroral";

/** The dim, decorative procedural galaxy behind everything — reproducible from `seed`. */
export type GalaxyBackdrop = {
  seed: number;
  branches: number; // spiral arms (2–5)
  spin: number;
  randomnessPower: number; // ~2.2 core bias
  palette: Palette;
};

/** Which tier of the universe a thing lives in (ADR-0008). */
export type Tier = "localGroup" | "galaxy" | "solarSystem";

/**
 * Where a Memory Star (or a scenery node) sits in the 3-tier universe (ADR-0008 §2).
 * Polar `(r, angle)` — the *same* convention as today's flat stars, never cartesian.
 * `parentId` names the containing node (a galaxy / solar-system id); it's absent at the
 * local-group tier. For a Memory Star, `(r, angle)` mirror the star's own coords.
 */
export type Placement = {
  tier: Tier;
  parentId?: string;
  r: number; // distance from the node center, 0..1
  angle: number; // radians
};

/** One real memory, placed as a star by the agent. */
export type MemoryStar = {
  id: string; // stable, deep-linkable (the bot's reply links to this)
  text: string; // the memory, already moderated + trimmed by the agent
  mood: Mood;
  color: string; // agent-chosen hex, derived from mood — never recolored in the UI
  r: number; // distance from center, 0..1
  angle: number; // radians — where on the sky
  brightness: number; // 0..1 — drives glow + size
  createdAt: number; // epoch ms; supplied by the caller at add-time (never Date.now() at module scope)
  name?: string; // short title shown on hover / in the panel
  who?: string | null; // opt-in attribution; null/absent = anonymous (brief §6)
  egg?: boolean; // the hidden dedication star (reveal on click)
  deep?: boolean; // the "fly-home" deep-story star (separate from the egg)
  // Where this star lives in the universe (ADR-0008 §2). Optional for back-compat:
  // a star without `placement` defaults to the home galaxy (`tier:'galaxy', parentId:'home'`).
  placement?: Placement;
};

/** What the frontend reads to draw the sky. */
export type GalaxySky = {
  backdrop: GalaxyBackdrop;
  stars: MemoryStar[];
};

// ── 3-tier scene graph (ADR-0008) ──────────────────────────────────────────────
// Scenery is *derived* from a seed, never stored. Only Memory Stars are persisted.
// Every node carries its own `seed` so child generators are pure functions of it.

/** The decorative super-massive object at a galaxy's core — scenery, never a memory. */
export type BlackHole = {
  seed: number;
  radius: number; // 0..1, the event-horizon glow scale
};

/** A solar system's central star — scenery, NOT a memory (the memory is a Memory Star). */
export type Sun = {
  seed: number;
  color: string; // hex
  radius: number; // 0..1
};

/** A tier-3 scenery leaf orbiting a sun. */
export type PlanetNode = {
  id: string;
  seed: number;
  color: string; // hex
  orbit: number; // 0..1, distance from the sun
  placement: Placement; // { tier:'solarSystem', parentId:<systemId>, r, angle }
};

/** A tier-3 container inside a galaxy (a sun + its planets). */
export type SolarSystemNode = {
  id: string;
  seed: number;
  sun: Sun;
  planets: PlanetNode[];
  placement: Placement; // { tier:'galaxy', parentId:<galaxyId>, r, angle }
};

/**
 * A tier-2 node. The `home` galaxy reuses today's seeded sky verbatim — its
 * `backdrop` + `stars` are exactly the existing `GalaxySky`, so `GalaxySky` is the
 * tier-2 projection of `home` (ADR-0008 §3).
 */
export type GalaxyNode = {
  id: string;
  seed: number;
  backdrop: GalaxyBackdrop;
  blackHole: BlackHole;
  stars: MemoryStar[]; // seeded for `home`; empty for procedural galaxies (v1)
  solarSystems: SolarSystemNode[];
  placement: Placement; // { tier:'localGroup', r, angle }
};

/** Tier 1 — the local group of galaxies, derived from the universe seed. */
export type LocalGroup = {
  seed: number;
  galaxies: GalaxyNode[];
};

/** The whole derived universe; only its Memory Stars are ever persisted. */
export type Universe = {
  seed: number;
  localGroup: LocalGroup;
};

/**
 * Transport-agnostic store seam. In-memory now; a KV / Durable-Object impl can be
 * added later without touching callers (ADR-0003+). `getSky()` is synchronous for
 * the in-memory impl; the interface is intentionally small so an async transport
 * can wrap it.
 *
 * The universe-aware reads (`getUniverse` / `skyFor` / `starsForView` / `homeNode`)
 * *extend*, never replace, the flat `getSky()` home-galaxy projection (ADR-0008 §5).
 */
export type GalaxyStore = {
  getSky(): GalaxySky; // the home-galaxy (tier-2) projection — unchanged contract
  addStar(star: MemoryStar): void; // append-only; never moves existing stars
  subscribe?(fn: (sky: GalaxySky) => void): () => void; // optional; live-growth later
  getUniverse?(): Universe; // the full derived scene graph (scenery + placed stars)
  homeNode?(): GalaxyNode; // the Local Group's focused/home tier-2 node, with live stars
  skyFor?(nodeId: string): GalaxySky; // a per-galaxy `GalaxySky` projection
  starsForView?(tier: Tier, parentId?: string): MemoryStar[]; // stars placed in one view
};
