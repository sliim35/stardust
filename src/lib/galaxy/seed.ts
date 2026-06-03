/**
 * The seed sky a stranger inherits: a default `GalaxyBackdrop` + a small curated
 * set of `MemoryStar`s (a subset of `stardust/project/memory-data.jsx`), including
 * the quiet `egg` and the deep "fly-home" star.
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

import type {
  GalaxyBackdrop,
  GalaxySky,
  MemoryStar,
  Mood,
} from "#/lib/galaxy/types";

/**
 * Feeling → color + the angular sector of the disk it occupies, so same-mood stars
 * gather into a constellation. The agent ultimately owns `color`; this map is for
 * seeding + validation only.
 */
export const MOODS = {
  joyful: { color: "#f0c987", angle: -1.15, spread: 0.62 },
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

/** The default dim procedural galaxy. Palette defaults to `auroral` (design spec). */
export const DEFAULT_BACKDROP = {
  seed: 7777,
  branches: 4,
  spin: 1,
  randomnessPower: 2.2,
  palette: "auroral",
} as const satisfies GalaxyBackdrop;

// ── tiny seeded helpers (mirrors src/lib/starfield.ts mulberry32) ──────────────
const memHash = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const memRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Deterministically place a star within its mood's wedge. Same id → same
 * `(r, angle)` forever, which is the invariant that keeps everyone's star put.
 */
export const placeStar = (
  id: string,
  mood: Mood,
): { r: number; angle: number } => {
  const m = MOODS[mood];
  const rng = memRng(memHash(id));
  const angle = m.angle + (rng() - 0.5) * m.spread;
  const r = 0.4 + rng() * 0.48;
  return { r, angle };
};

// ── the curated seed corpus (subset of the prototype's 36) ─────────────────────
type SeedSpec = {
  mood: Mood;
  name: string;
  text: string;
  who?: string;
};

const SEED = [
  {
    mood: "joyful",
    name: "kitchen radio",
    who: "marco",
    text: "dad dancing badly in the kitchen while the radio played something from before i was born.",
  },
  {
    mood: "tender",
    name: "his steady hands",
    who: "lena",
    text: "the way grandfather's hands shook pouring tea, and never once spilled a drop.",
  },
  {
    mood: "grieving",
    name: "the voicemail",
    text: "i cannot delete the voicemail. i never play it. i just keep it there.",
  },
  {
    mood: "wistful",
    name: "the old number",
    text: "i still know the phone number of a house we left behind twenty years ago.",
  },
  {
    mood: "peaceful",
    name: "rain on tin",
    who: "ana",
    text: "rain on the tin roof of the cabin, and nothing in the world that needed doing.",
  },
  {
    mood: "wonder",
    name: "saturn, actually",
    who: "ken",
    text: "the night dad aimed the telescope and i actually saw the rings of saturn, real.",
  },
] as const satisfies readonly SeedSpec[];

// Fixed backdated epoch so seed order is stable and clock-free.
const SEED_EPOCH = 1748000000000;

// ── the two special stars (fixed homes; not derived from the SEED loop) ────────
// Irina — the deep "fly-home" story star. (r, angle) precomputed from the
// prototype's Sol marker so the meaning is preserved without stage geometry here.
const DEEP_STAR = {
  id: "irina",
  deep: true,
  name: "for mom",
  who: null,
  mood: "nostalgic",
  color: "#f5d6a0",
  text: "a whole life, lived right here on the third stone from this star. follow her home.",
  r: 0.366,
  angle: 0.423,
  brightness: 1,
  createdAt: 1700000000000,
} as const satisfies MemoryStar;

// The egg — quiet, in a lower-right inter-arm pocket, a touch brighter than its
// neighbours. Reveals its dedication only on click; the UI just honors the flag.
const EGG_STAR = {
  id: "egg",
  egg: true,
  who: null,
  mood: "joyful",
  color: "#f7dca8",
  text: "for the one who taught me to look up. the gold was always hers; the rest is the universe she lived in.",
  r: 0.95,
  angle: 1.52,
  brightness: 0.92,
  createdAt: 0,
} as const satisfies MemoryStar;

/** Build the initial sky from the seed corpus. Stable ids → stable positions forever. */
export const buildSeedSky = (): GalaxySky => {
  const stars: MemoryStar[] = SEED.map((s: SeedSpec, i) => {
    const id = `s${String(i + 1).padStart(2, "0")}`;
    const { r, angle } = placeStar(id, s.mood);
    const rng = memRng(memHash(id) ^ 0x9e3779b9);
    return {
      id,
      text: s.text,
      name: s.name,
      mood: s.mood,
      who: s.who ?? null,
      color: MOODS[s.mood].color,
      r,
      angle,
      brightness: 0.55 + rng() * 0.4,
      createdAt: SEED_EPOCH + i * 3600000,
    };
  });
  stars.push({ ...DEEP_STAR }, { ...EGG_STAR });
  return { backdrop: { ...DEFAULT_BACKDROP }, stars };
};
