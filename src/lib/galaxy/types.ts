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

import type { Messages } from "#/lib/i18n/types";

/**
 * The i18n catalog key for a real object's lore entry (name + sublabel + ASTRO's
 * lore line). Derived from the `lore` namespace of `Messages` so the data module's
 * `loreKey`s stay compile-locked to the en+ru catalog — a missing/typo'd key fails
 * to type-check (ADR-0010 §4: "no inline user-facing strings").
 */
export type LoreKey = keyof Messages["lore"];

/**
 * The 12 emotions that partition across the Local Group's galaxies (ADR-0014 §1,
 * BR25/BR26). Listed in **galaxy-partition order** — the 3 Milky Way emotions, then
 * Andromeda, Triangulum, LMC (`EMOTION_GALAXY` in `seed.ts` is the source of truth
 * for the partition itself). The first 7 are the original `Mood` literals; the last
 * 5 (`hope`/`gratitude`/`courage`/`pride`/`longing`) are the #187 widening.
 */
export type Emotion =
  | "joyful"
  | "tender"
  | "grieving"
  | "wonder"
  | "nostalgic"
  | "hope"
  | "peaceful"
  | "wistful"
  | "gratitude"
  | "courage"
  | "pride"
  | "longing";

/**
 * @deprecated Use {@link Emotion}. Kept as a back-compat alias so every existing
 * `Mood` consumer (`MemoryStar.mood`, `placeStar`, `isMood`, the Drizzle enum, the
 * AI classifier) compiles unchanged through the 7→12 widening (ADR-0014 §1).
 */
export type Mood = Emotion;

/**
 * What sparked a memory (BR28): a **person** or an **action/event**. Same kind of
 * star, same figure either way — `trigger` is card metadata, not a layer or a
 * membership change (ADR-0014 §4). Optional on `MemoryStar` → fully back-compat.
 */
export type Trigger = "person" | "action";

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
  // Mood-constellation membership (Layer B — ADR-0010 §1/§4-④, spec §3): the
  // `ConstellationFigure.group` key of the authored figure this star belongs to;
  // absent/undefined = standalone (Mom's gold star, solo moods). Additive +
  // optional → fully back-compat with today's flat stars.
  group?: string;
  // What sparked this memory (BR28 — ADR-0014 §4): a person or an action/event.
  // Optional → seeded stars + existing rows default to absent (no trigger chip).
  // Same figure either way; this is card metadata, not a membership change.
  trigger?: Trigger;
  // Where this star lives in the universe (ADR-0008 §2). Optional for back-compat:
  // a star without `placement` defaults to the home galaxy (`tier:'galaxy', parentId:'home'`).
  placement?: Placement;
};

/** What the frontend reads to draw the sky. */
export type GalaxySky = {
  backdrop: GalaxyBackdrop;
  stars: MemoryStar[];
};

/**
 * A designed slot in a figure's silhouette (ADR-0014 §2): a stable `id` plus the
 * polar position a member bound to it renders at. The silhouette geometry is
 * hand-authored per figure (a design-role deliverable, BR30-gated) — the same
 * `(r, angle)` convention as `placeStar` / `polarToXY`.
 */
export type FigureAnchor = { id: string; r: number; angle: number };

/**
 * One authored emotion-constellation figure (ADR-0014 §2, evolving the #154 owner
 * rules). A **pre-designed** figure whose anchor topology must read as the emotion
 * — NEVER an emergent `createdAt`-ordered chain (rule 3). Every member shares the
 * figure's single `emotion` (rule 1), and since colour maps from emotion
 * (`MOODS[emotion].color`), a figure is single-colour **by construction** (rule 2).
 *
 * Membership is **derived** — the set of stars whose `group === figure.group` — so
 * the figure no longer carries a `members[]` id list. The Nth-created member (stable
 * `createdAt`/id order) binds to the Nth open anchor (`assignAnchors`), so adding a
 * star never moves an existing one (the `placeStar` invariant, generalized to a
 * designed shape). `forming`/`finished` is derived from the live member count vs
 * `threshold` — never stored. The host galaxy is derived from `emotion` via the
 * partition map (`EMOTION_GALAXY`); `hostGalaxyId` must equal `hostGalaxyFor(emotion)`.
 */
export type ConstellationFigure = {
  /** Stable membership key — mirrored in each member star's `group`. */
  group: string;
  /** The ONE emotion every member shares; the figure's stroke colour derives from it. */
  emotion: Emotion;
  /** The real galaxy that hosts this figure (§3); equals `hostGalaxyFor(emotion)`. */
  hostGalaxyId: string;
  /** The per-figure "finished" member count (BR27 — `>= 10`). */
  threshold: number;
  /** The designed silhouette slots — hand-authored polar positions. */
  anchors: readonly FigureAnchor[];
  /** The designed edge topology — pairs of ANCHOR ids; segments come from these only. */
  edges: readonly (readonly [string, string])[];
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

// ── Layer A — the curated real-astronomy dataset (ADR-0010 §4) ─────────────────
// The real *setting* the visitor lands in: the real Milky Way + its real Local-Group
// neighbours + real labelled deep-space features, at their real light-year distances.
// Authored as a static `as const` list (`realdata.ts`) — SSR-safe, no module-scope
// `Math.random()` / `Date.now()`. Real objects are NOT memories (Layer B); they carry
// their own positions/colours/lore and never recolor or anchor a Memory Star.

/** What sort of real object this is — drives which silhouette/feature the renderer draws. */
export type RealKind = "galaxy" | "nebula" | "star" | "marker" | "armLabel";

/** Real morphology (spec §5.1a) → which silhouette the renderer draws. */
export type RealShape =
  | "barred-spiral"
  | "spiral"
  | "flocculent-spiral"
  | "magellanic"
  | "irregular"
  | "dwarf-spheroidal"
  | "nebula"
  | "star"
  | "marker";

/**
 * The *real* distance — the published heliocentric figure, rounded to display
 * precision (spec §5.1). Decoupled from `placement`: it powers the lore card + the
 * scale-net labels, not the render position. (No `AU` in v1 — the Solar-System tier
 * is deferred to #127; the unit union extends there.)
 */
export type RealDistance = {
  value: number;
  unit: "ly" | "Mly";
};

/**
 * A real object in Layer A. The `(r, angle)` placement is **hand-authored
 * close-to-real** — ordered by real distance, recognizable, NOT a survey-accurate
 * projection (ADR-0010 §4-②, no `logScale` engine). `loreKey` is the i18n seam:
 * the ASTRO lore line + name/sublabel copy live in the catalog (en+ru), never inline.
 * `gateway:true` ONLY on the home Milky Way + Sol.
 */
export type RealObject = {
  id: string; // stable, deep-linkable
  kind: RealKind;
  name: string; // dev/debug label — user-facing copy is in `loreKey`'s catalog entry
  catalogue?: string; // e.g. "M31"
  tier: Tier;
  parentId?: string;
  realDistance: RealDistance;
  placement: { r: number; angle: number }; // polar render position (0..1, radians)
  shape: RealShape;
  size: number; // 0..1 relative silhouette scale
  brightness: number; // 0..1
  color: string; // hex; cool palette — gold (#f5d6a0) reserved for chrome/Sol
  loreKey: LoreKey; // i18n catalog key → name + sublabel + ASTRO lore line (en+ru)
  gateway?: boolean; // descendable — ONLY the home Milky Way + Sol
  // galaxy extras
  arms?: number;
  barAngle?: number; // radians
  tilt?: number; // disk inclination, radians
  satellites?: readonly RealObject[]; // M31 → optional M32 / M110
};
