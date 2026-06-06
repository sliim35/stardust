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
  ConstellationFigure,
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

// ── mood constellations (Layer B — ADR-0010 §1/§4-④, #146; owner rules 2026-06-06) ──
// Each constellation is an AUTHORED figure (issue #154 amendment): one mood per
// figure (rule 1 — hence one colour, rule 2), a designed edge topology like a real
// constellation (rule 3 — never an emergent `createdAt` chain). The `group` key is
// the stable membership marker mirrored on each member star; member ids are the
// `s${index+1}` ids `buildSeedSky` derives from SEED order (a drifted id fails the
// seed mood-purity test). Same-mood members share a `placeStar` wedge, so each
// figure reads as a local shape. Mom's star stays ungrouped (standalone), per
// ADR-0010 §1 + the Mom's-star treatment (2026-06-06).
export const CONSTELLATIONS = {
  // "bright days" — the joyful figure: a slightly irregular closed triangle
  // (3 nodes / 3 edges — deliberately MORE edges than a chain could draw).
  brightDays: {
    group: "bright-days",
    mood: "joyful",
    members: ["s01", "s07", "s08"],
    edges: [
      ["s01", "s07"],
      ["s07", "s08"],
      ["s08", "s01"],
    ],
  },
  // "quiet ache" — the wistful figure: an open arc routed through s04 as its
  // hub (s09—s04—s10) — NOT the s04→s09→s10 createdAt chain.
  quietAche: {
    group: "quiet-ache",
    mood: "wistful",
    members: ["s04", "s09", "s10"],
    edges: [
      ["s09", "s04"],
      ["s04", "s10"],
    ],
  },
} as const satisfies Record<string, ConstellationFigure>;

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
    group: CONSTELLATIONS.brightDays.group,
  },
  // s02/s03/s05/s06 are SOLO stars — their moods have no authored figure yet, so
  // hover gives them the short description only (like Mom's star), per the
  // mood-pure redesign (owner rules, 2026-06-06).
  {
    mood: "tender",
    copyKey: "s02",
    who: "lena",
  },
  {
    mood: "grieving",
    copyKey: "s03",
  },
  {
    mood: "wistful",
    copyKey: "s04",
    group: CONSTELLATIONS.quietAche.group,
  },
  {
    mood: "peaceful",
    copyKey: "s05",
    who: "ana",
  },
  {
    mood: "wonder",
    copyKey: "s06",
    who: "ken",
  },
  // The corpus growth (owner rule 4): two more joyful + two more wistful stars so
  // both authored figures have >= 3 same-mood nodes.
  {
    mood: "joyful",
    copyKey: "s07",
    group: CONSTELLATIONS.brightDays.group,
  },
  {
    mood: "joyful",
    copyKey: "s08",
    who: "noor",
    group: CONSTELLATIONS.brightDays.group,
  },
  {
    mood: "wistful",
    copyKey: "s09",
    group: CONSTELLATIONS.quietAche.group,
  },
  {
    mood: "wistful",
    copyKey: "s10",
    who: "tomas",
    group: CONSTELLATIONS.quietAche.group,
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
