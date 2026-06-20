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
  Emotion,
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
 * Emotion → color + the angular sector of the disk it occupies, so same-emotion
 * stars gather into a constellation. The agent ultimately owns `color`; this map is
 * for seeding + validation only.
 *
 * Widened 7→12 for the #187 emotion partition (ADR-0014 §1). The 5 new hexes come
 * from spike #193 §2's colour table and are PROVISIONAL until ratified by the
 * colour proof (#193-B) or the owner. `gratitude` uses the 2026-06-20 proof verdict
 * `#e8b06a` (amber-orange) — the originally-proposed `#f0d890` golden-wheat was NOT
 * distinct enough from Mom's reserved gold `#f5d6a0` as a star-glow. `wistful` is
 * re-tuned `#c8d4e8`→`#b8c4e0` (blue-shifted per #193 §2 to distance it from the new
 * `longing` slate-blue). Gold `#f5d6a0` stays reserved for Mom/Sol/chrome.
 */
export const MOODS = {
  joyful: { color: "#f3c24e", angle: -1.15, spread: 0.62 },
  tender: { color: "#f3b8b0", angle: -0.15, spread: 0.55 },
  grieving: { color: "#8aa0d8", angle: 0.95, spread: 0.6 },
  wonder: { color: "#cbb8ef", angle: -2.05, spread: 0.55 },
  nostalgic: { color: "#e8c49a", angle: -2.75, spread: 0.55 },
  // PROVISIONAL — pending colour proof (#193-B or owner ratification): sage green.
  hope: { color: "#a8d8b0", angle: -2.4, spread: 0.55 },
  peaceful: { color: "#9cd8c0", angle: 2.7, spread: 0.55 },
  // Re-tuned `#c8d4e8`→`#b8c4e0` (blue-shifted, #193 §2) to distance from `longing`.
  wistful: { color: "#b8c4e0", angle: 1.95, spread: 0.62 },
  // PROVISIONAL — pending colour proof (#193-B or owner ratification). 2026-06-20
  // proof verdict: amber-orange `#e8b06a`, NOT the golden-wheat `#f0d890` (too close
  // to Mom's reserved gold `#f5d6a0` as a star-glow).
  gratitude: { color: "#e8b06a", angle: 2.35, spread: 0.55 },
  // PROVISIONAL — pending colour proof (#193-B or owner ratification): terracotta.
  courage: { color: "#e8906a", angle: 0.35, spread: 0.55 },
  // PROVISIONAL — pending colour proof (#193-B or owner ratification): dusty mauve.
  pride: { color: "#c8a0d0", angle: 0.6, spread: 0.55 },
  // PROVISIONAL — pending colour proof (#193-B or owner ratification): slate blue.
  longing: { color: "#a0b8d8", angle: 1.3, spread: 0.55 },
} as const satisfies Record<
  Emotion,
  { color: string; angle: number; spread: number }
>;

/**
 * The 12 `Emotion` literals as an ordered tuple — the single source for the Drizzle
 * `mood` enum (`schema.ts`) and the Workers-AI structured-output enum
 * (`mood-detect.ts`), so the DB column, the AI classifier, and the `Emotion` type
 * can never drift apart (the `satisfies` pins it to `Emotion`; `seed.test.ts` pins
 * it to every `MOODS` key).
 */
export const EMOTION_VALUES = [
  "joyful",
  "tender",
  "grieving",
  "wonder",
  "nostalgic",
  "hope",
  "peaceful",
  "wistful",
  "gratitude",
  "courage",
  "pride",
  "longing",
] as const satisfies readonly Emotion[];

/**
 * @deprecated Use {@link EMOTION_VALUES}. Back-compat alias so consumers that import
 * `MOOD_VALUES` (the Drizzle enum, the classifier) keep compiling through the 7→12
 * widening.
 */
export const MOOD_VALUES = EMOTION_VALUES;

/** Runtime guard: is an arbitrary value one of the 12 `Emotion` literals? */
export const isMood = (value: unknown): value is Emotion =>
  typeof value === "string" &&
  (EMOTION_VALUES as readonly string[]).includes(value);

/**
 * The owner-approved emotion→host-galaxy partition (BR26, ADR-0014 §3). Exactly one
 * galaxy per emotion; the 12 keys are exhaustive over `Emotion` (compile-checked by
 * `Record<Emotion, string>`). Ids match `realdata.ts`
 * (`home`/`andromeda`/`triangulum`/`lmc`). The host galaxy is NEVER stored on a star
 * — it is derived from the star's emotion via this map, so it can never drift.
 */
export const EMOTION_GALAXY: Record<Emotion, string> = {
  // Milky Way
  joyful: "home",
  tender: "home",
  grieving: "home",
  // Andromeda
  wonder: "andromeda",
  nostalgic: "andromeda",
  hope: "andromeda",
  // Triangulum
  peaceful: "triangulum",
  wistful: "triangulum",
  gratitude: "triangulum",
  // LMC
  courage: "lmc",
  pride: "lmc",
  longing: "lmc",
};

/** The galaxy id that hosts a given emotion's figure (BR26). */
export const hostGalaxyFor = (e: Emotion): string => EMOTION_GALAXY[e];

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

// ── emotion constellations (Layer B — ADR-0014 §2; #187) ───────────────────────
// The two prototype figures (`brightDays` joyful / `quietAche` wistful) are RETIRED
// (spike #194 §5, AC8): they used member-id edges + 3-member thresholds, which the
// designed-anchor model (anchor-id edges, `threshold >= 10`) supersedes. Their seed
// stars' `group` is cleared below → they render SOLO until designed figures claim
// them. `CONSTELLATIONS` starts EMPTY: the per-emotion silhouette geometries
// (`anchors`/`edges`/`threshold`) are a design-role deliverable, authored + verified
// per emotion (BR30-gated) in the downstream per-emotion design stories. Each future
// entry must satisfy `anchors.length >= 10 && threshold >= 10 && hostGalaxyId ===
// hostGalaxyFor(emotion)` (the structural gate). Typed by the new anchor-model shape.
export const CONSTELLATIONS: Record<string, ConstellationFigure> = {};

// ── the curated seed corpus (subset of the prototype's 36) ─────────────────────
// `copyKey` indexes the i18n `memoryStars` catalog — no inline name/text here
// (ADR-0010 §4). `group` assigns the star into a mood constellation (or none).
type SeedSpec = {
  mood: Mood;
  copyKey: keyof typeof COPY;
  who?: string;
  group?: string;
};

// The prototype figures are retired (AC8), so every seed star is now SOLO — no
// `group`. Hover gives each the short description only (like Mom's star), per the
// emotion-figure redesign (ADR-0014 §2). Designed figures will claim stars once the
// per-emotion silhouettes land (BR30-gated).
const SEED = [
  {
    mood: "joyful",
    copyKey: "s01",
    who: "marco",
  },
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
  {
    mood: "joyful",
    copyKey: "s07",
  },
  {
    mood: "joyful",
    copyKey: "s08",
    who: "noor",
  },
  {
    mood: "wistful",
    copyKey: "s09",
  },
  {
    mood: "wistful",
    copyKey: "s10",
    who: "tomas",
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
