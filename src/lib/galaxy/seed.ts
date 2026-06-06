/**
 * The seed sky a stranger inherits: a default `GalaxyBackdrop` + a small curated
 * set of `MemoryStar`s (a subset of `stardust/project/memory-data.jsx`), including
 * the deep "fly-home" star — Mom's lone gold dedication star.
 *
 * Placement is a **pure function of the star's stable id** — that is *why*
 * appending a star never moves the others (the store only appends; positions are
 * derived, never re-solved). No module-scope `Math.random()` / `Date.now()`:
 * everything is seeded and `createdAt` is a fixed backdated constant, so the seed
 * is byte-stable across SSR and the client (ADR-0003).
 *
 * `color` and `(r, angle)` are the agent's vocabulary — this module assigns them
 * for the seed corpus only; nothing here recolors a star supplied later.
 */

import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import type {
  GalaxyBackdrop,
  GalaxySky,
  MemoryStar,
  Mood,
} from "#/lib/galaxy/types";
import { en } from "#/lib/i18n/messages/en";

/**
 * Seed memory-star copy comes from the i18n catalog (ADR-0010 §4 — no inline
 * user-facing strings). `buildSeedSky` resolves each star's `name`/`text` from the
 * `en` source-of-truth corpus by id; the locale-aware swap is a render-layer concern
 * (en+ru parity is compile-enforced in `i18n/types.ts`). Resolving from `en` here
 * keeps `buildSeedSky` a pure, SSR-safe, locale-agnostic function (no React/router).
 */
const COPY = en.memoryStars;

/**
 * Feeling → color + the angular sector of the disk it occupies, so same-mood stars
 * gather into a constellation. The agent ultimately owns `color`; this map is for
 * seeding + validation only.
 */
export const MOODS = {
  joyful: { color: "#f3c24e", angle: -1.15, spread: 0.62 },
  tender: { color: "#f3b8b0", angle: -0.15, spread: 0.55 },
  grieving: { color: "#8aa0d8", angle: 0.95, spread: 0.6 },
  wistful: { color: "#c8d4e8", angle: 1.95, spread: 0.62 },
  peaceful: { color: "#9cd8c0", angle: 2.7, spread: 0.55 },
  nostalgic: { color: "#e8c49a", angle: -2.75, spread: 0.55 },
  wonder: { color: "#cbb8ef", angle: -2.05, spread: 0.55 },
} as const satisfies Record<
  Mood,
  { color: string; angle: number; spread: number }
>;

/** The default dim procedural galaxy. Palette defaults to `ember` (amber) — owner
 *  resolved amber-vs-green → amber (2026-06-04), matching ASTRO/STARLIGHT + loader. */
export const DEFAULT_BACKDROP = {
  seed: 7777,
  branches: 4,
  spin: 1,
  randomnessPower: 2.2,
  palette: "ember",
} as const satisfies GalaxyBackdrop;

/**
 * Deterministically place a star within its mood's wedge. Same id → same
 * `(r, angle)` forever, which is the invariant that keeps everyone's star put.
 */
export const placeStar = (
  id: string,
  mood: Mood,
): { r: number; angle: number } => {
  const m = MOODS[mood];
  const rng = mulberry32(hashStr(id));
  const angle = m.angle + (rng() - 0.5) * m.spread;
  const r = 0.4 + rng() * 0.48;
  return { r, angle };
};

// ── mood constellations (Layer B — ADR-0010 §1/§4-④, #146) ─────────────────────
// Same-`group` seed stars connect into one constellation (in `createdAt` order). The
// names are owner-facing constellation captions — but they are NOT user-visible copy
// here; the group is a stable membership key consumed by the overlay (spec §3) which
// reads the mood label from the i18n `moods` catalog. Mom's star stays ungrouped
// (standalone), per ADR-0010 §1 + the Mom's-star treatment (2026-06-06).
export const CONSTELLATIONS = {
  brightDays: "bright-days",
  quietAche: "quiet-ache",
} as const;

// ── the curated seed corpus (subset of the prototype's 36) ─────────────────────
// `copyKey` indexes the i18n `memoryStars` catalog — no inline name/text here
// (ADR-0010 §4). `group` assigns the star into a mood constellation (or none).
type SeedSpec = {
  mood: Mood;
  copyKey: keyof typeof COPY;
  who?: string;
  group?: string;
};

const SEED = [
  {
    mood: "joyful",
    copyKey: "s01",
    who: "marco",
    group: CONSTELLATIONS.brightDays,
  },
  {
    mood: "tender",
    copyKey: "s02",
    who: "lena",
    group: CONSTELLATIONS.quietAche,
  },
  {
    mood: "grieving",
    copyKey: "s03",
    group: CONSTELLATIONS.quietAche,
  },
  {
    mood: "wistful",
    copyKey: "s04",
    group: CONSTELLATIONS.quietAche,
  },
  {
    mood: "peaceful",
    copyKey: "s05",
    who: "ana",
    group: CONSTELLATIONS.brightDays,
  },
  {
    mood: "wonder",
    copyKey: "s06",
    who: "ken",
    group: CONSTELLATIONS.brightDays,
  },
] as const satisfies readonly SeedSpec[];

// Fixed backdated epoch so seed order is stable and clock-free.
const SEED_EPOCH = 1748000000000;

// ── Mom's lone gold star (fixed home; not derived from the SEED loop) ──────────
// Stays UNGROUPED (standalone) per ADR-0010 §1 + the Mom's-star treatment
// (2026-06-06) — the gold dedication star never joins a mood constellation. Its
// `name`/`text` resolve from the i18n catalog by id (no inline copy). Irina is the
// biggest + brightest of the whole sky (brightness 1, the unique max — #146), sits
// near bottom-centre (r 0.92, angle ≈ π/2), and reserves the pale gold `#f5d6a0`
// (no regular mood color sits near it). The hidden `egg` star is retired — its
// dedication merged into Mom's copy (treatment §1/§2).
const DEEP_STAR = {
  id: "irina",
  copyKey: "irina",
  deep: true,
  who: null,
  mood: "nostalgic",
  color: "#f5d6a0",
  r: 0.92,
  angle: 1.571,
  brightness: 1,
  createdAt: 1700000000000,
} as const;

/** Build the initial sky from the seed corpus. Stable ids → stable positions forever. */
export const buildSeedSky = (): GalaxySky => {
  const stars: MemoryStar[] = SEED.map((s: SeedSpec, i) => {
    const id = `s${String(i + 1).padStart(2, "0")}`;
    const { r, angle } = placeStar(id, s.mood);
    const rng = mulberry32(hashStr(id) ^ 0x9e3779b9);
    return {
      id,
      text: COPY[s.copyKey].text,
      name: COPY[s.copyKey].name,
      mood: s.mood,
      who: s.who ?? null,
      color: MOODS[s.mood].color,
      r,
      angle,
      // Cap below 1 so Mom's star (brightness 1) is the unique brightest (#146).
      brightness: 0.55 + rng() * 0.4,
      createdAt: SEED_EPOCH + i * 3600000,
      group: s.group,
    };
  });
  // Mom's lone gold star resolves its copy from the catalog and stays ungrouped.
  for (const spec of [DEEP_STAR] as const) {
    const { copyKey, ...rest } = spec;
    stars.push({
      ...rest,
      name: COPY[copyKey].name,
      text: COPY[copyKey].text,
    });
  }
  return { backdrop: { ...DEFAULT_BACKDROP }, stars };
};
