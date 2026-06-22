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

// The 12 emotion silhouettes — owner's Claude Design "Twelve Figures.html" (2026-06-22),
// one per emotion (10 anchors / threshold 10 / single colour; pinned by
// figure-verification.test.ts). Anchors are inverted with each figure's HOST-galaxy tilt,
// so the renderer must thread per-host tilt for the non-home galaxies (#234) — MW is correct.
export const CONSTELLATIONS = {
  joyful: {
    group: "joyful",
    emotion: "joyful",
    hostGalaxyId: "home",
    threshold: 10,
    anchors: [
      { id: "m0", r: 0.5486, angle: -2.3236 },
      { id: "m1", r: 0.3918, angle: -2.4385 },
      { id: "m2", r: 0.2417, angle: -2.4918 },
      { id: "m3", r: 0.1117, angle: -2.2075 },
      { id: "m4", r: 0.1117, angle: -0.9341 },
      { id: "m5", r: 0.2417, angle: -0.6498 },
      { id: "m6", r: 0.3918, angle: -0.7031 },
      { id: "m7", r: 0.5486, angle: -0.818 },
      { id: "eye-l", r: 0.5922, angle: -1.8856 },
      { id: "eye-r", r: 0.5922, angle: -1.256 },
    ],
    edges: [
      ["m0", "m1"],
      ["m1", "m2"],
      ["m2", "m3"],
      ["m3", "m4"],
      ["m4", "m5"],
      ["m5", "m6"],
      ["m6", "m7"],
    ],
  },
  tender: {
    group: "tender",
    emotion: "tender",
    hostGalaxyId: "home",
    threshold: 10,
    anchors: [
      { id: "t", r: 0.2177, angle: -1.5708 },
      { id: "ru", r: 0.3882, angle: -1.1896 },
      { id: "ro", r: 0.366, angle: -0.7435 },
      { id: "rm", r: 0.2859, angle: -0.2386 },
      { id: "rl", r: 0.2202, angle: 0.7502 },
      { id: "b", r: 0.3904, angle: 1.5708 },
      { id: "ll", r: 0.2202, angle: 2.3914 },
      { id: "lm", r: 0.2859, angle: -2.903 },
      { id: "lo", r: 0.366, angle: -2.3981 },
      { id: "lu", r: 0.3882, angle: -1.952 },
    ],
    edges: [
      ["t", "ru"],
      ["ru", "ro"],
      ["ro", "rm"],
      ["rm", "rl"],
      ["rl", "b"],
      ["b", "ll"],
      ["ll", "lm"],
      ["lm", "lo"],
      ["lo", "lu"],
      ["lu", "t"],
    ],
  },
  grieving: {
    group: "grieving",
    emotion: "grieving",
    hostGalaxyId: "home",
    threshold: 10,
    anchors: [
      { id: "tip", r: 0.4204, angle: -1.5708 },
      { id: "r1", r: 0.1995, angle: -1.0459 },
      { id: "r2", r: 0.1824, angle: 0.3355 },
      { id: "r3", r: 0.2933, angle: 1.0558 },
      { id: "rb", r: 0.376, angle: 1.3624 },
      { id: "b", r: 0.4054, angle: 1.5708 },
      { id: "lb", r: 0.376, angle: 1.7792 },
      { id: "l3", r: 0.2933, angle: 2.0858 },
      { id: "l2", r: 0.1824, angle: 2.806 },
      { id: "l1", r: 0.1995, angle: -2.0957 },
    ],
    edges: [
      ["tip", "r1"],
      ["r1", "r2"],
      ["r2", "r3"],
      ["r3", "rb"],
      ["rb", "b"],
      ["b", "lb"],
      ["lb", "l3"],
      ["l3", "l2"],
      ["l2", "l1"],
      ["l1", "tip"],
    ],
  },
  wonder: {
    group: "wonder",
    emotion: "wonder",
    hostGalaxyId: "andromeda",
    threshold: 10,
    anchors: [
      { id: "o0", r: 0.7407, angle: -1.5708 },
      { id: "i0", r: 0.2461, angle: -1.2746 },
      { id: "o1", r: 0.3741, angle: -0.6584 },
      { id: "i1", r: 0.147, angle: 0.6584 },
      { id: "o2", r: 0.6266, angle: 1.2746 },
      { id: "i2", r: 0.291, angle: 1.5708 },
      { id: "o3", r: 0.6266, angle: 1.867 },
      { id: "i3", r: 0.147, angle: 2.4831 },
      { id: "o4", r: 0.3741, angle: -2.4831 },
      { id: "i4", r: 0.2461, angle: -1.867 },
    ],
    edges: [
      ["o0", "i0"],
      ["i0", "o1"],
      ["o1", "i1"],
      ["i1", "o2"],
      ["o2", "i2"],
      ["i2", "o3"],
      ["o3", "i3"],
      ["i3", "o4"],
      ["o4", "i4"],
      ["i4", "o0"],
    ],
  },
  nostalgic: {
    group: "nostalgic",
    emotion: "nostalgic",
    hostGalaxyId: "andromeda",
    threshold: 10,
    anchors: [
      { id: "o0", r: 0.7275, angle: -1.5708 },
      { id: "o1", r: 0.6355, angle: -1.8634 },
      { id: "o2", r: 0.4008, angle: -2.3758 },
      { id: "o3", r: 0.4195, angle: 2.3303 },
      { id: "o4", r: 0.6466, angle: 1.8493 },
      { id: "o5", r: 0.7275, angle: 1.5708 },
      { id: "i0", r: 0.4774, angle: 1.3239 },
      { id: "i1", r: 0.2302, angle: 0.761 },
      { id: "i2", r: 0.2395, angle: -0.801 },
      { id: "i3", r: 0.4903, angle: -1.3305 },
    ],
    edges: [
      ["o0", "o1"],
      ["o1", "o2"],
      ["o2", "o3"],
      ["o3", "o4"],
      ["o4", "o5"],
      ["o5", "i0"],
      ["i0", "i1"],
      ["i1", "i2"],
      ["i2", "i3"],
      ["i3", "o0"],
    ],
  },
  hope: {
    group: "hope",
    emotion: "hope",
    hostGalaxyId: "andromeda",
    threshold: 10,
    anchors: [
      { id: "ring", r: 0.7407, angle: -1.5708 },
      { id: "top", r: 0.5159, angle: -1.5708 },
      { id: "sl", r: 0.4119, angle: -1.9435 },
      { id: "sr", r: 0.4119, angle: -1.198 },
      { id: "mid", r: 0.172, angle: -1.5708 },
      { id: "crown", r: 0.5423, angle: 1.5708 },
      { id: "lf", r: 0.4177, angle: 2.1161 },
      { id: "lt", r: 0.2756, angle: 2.8494 },
      { id: "rf", r: 0.4177, angle: 1.0255 },
      { id: "rt", r: 0.2756, angle: 0.2921 },
    ],
    edges: [
      ["ring", "top"],
      ["sl", "top"],
      ["top", "sr"],
      ["top", "mid"],
      ["mid", "crown"],
      ["crown", "lf"],
      ["lf", "lt"],
      ["crown", "rf"],
      ["rf", "rt"],
    ],
  },
  peaceful: {
    group: "peaceful",
    emotion: "peaceful",
    hostGalaxyId: "triangulum",
    threshold: 10,
    anchors: [
      { id: "tip", r: 0.3457, angle: -1.5708 },
      { id: "ru", r: 0.21, angle: -0.9167 },
      { id: "rm", r: 0.1575, angle: 0.1574 },
      { id: "rl", r: 0.2189, angle: 1.1248 },
      { id: "base", r: 0.3025, angle: 1.5708 },
      { id: "ll", r: 0.2189, angle: 2.0168 },
      { id: "lm", r: 0.1575, angle: 2.9842 },
      { id: "lu", r: 0.21, angle: -2.2249 },
      { id: "v1", r: 0.1049, angle: -1.5708 },
      { id: "v2", r: 0.1111, angle: 1.5708 },
    ],
    edges: [
      ["tip", "ru"],
      ["ru", "rm"],
      ["rm", "rl"],
      ["rl", "base"],
      ["base", "ll"],
      ["ll", "lm"],
      ["lm", "lu"],
      ["lu", "tip"],
      ["tip", "v1"],
      ["v1", "v2"],
      ["v2", "base"],
    ],
  },
  wistful: {
    group: "wistful",
    emotion: "wistful",
    hostGalaxyId: "triangulum",
    threshold: 10,
    anchors: [
      { id: "w0", r: 0.5181, angle: 2.8764 },
      { id: "w1", r: 0.3948, angle: 2.9687 },
      { id: "w2", r: 0.286, angle: -2.9018 },
      { id: "w3", r: 0.215, angle: -2.4579 },
      { id: "w4", r: 0.0877, angle: -2.2565 },
      { id: "w5", r: 0.0877, angle: 0.8851 },
      { id: "w6", r: 0.215, angle: 0.6837 },
      { id: "w7", r: 0.286, angle: 0.2397 },
      { id: "w8", r: 0.3948, angle: -0.1729 },
      { id: "w9", r: 0.5181, angle: -0.2652 },
    ],
    edges: [
      ["w0", "w1"],
      ["w1", "w2"],
      ["w2", "w3"],
      ["w3", "w4"],
      ["w4", "w5"],
      ["w5", "w6"],
      ["w6", "w7"],
      ["w7", "w8"],
      ["w8", "w9"],
    ],
  },
  gratitude: {
    group: "gratitude",
    emotion: "gratitude",
    hostGalaxyId: "triangulum",
    threshold: 10,
    anchors: [
      { id: "rl", r: 0.2718, angle: -2.6444 },
      { id: "b1", r: 0.1953, angle: 3.0466 },
      { id: "b2", r: 0.1707, angle: 2.2794 },
      { id: "b3", r: 0.1667, angle: 1.5708 },
      { id: "b4", r: 0.1707, angle: 0.8622 },
      { id: "b5", r: 0.1953, angle: 0.095 },
      { id: "rr", r: 0.2718, angle: -0.4972 },
      { id: "stem", r: 0.284, angle: 1.5708 },
      { id: "baseL", r: 0.3397, angle: 1.904 },
      { id: "baseR", r: 0.3397, angle: 1.2376 },
    ],
    edges: [
      ["rl", "b1"],
      ["b1", "b2"],
      ["b2", "b3"],
      ["b3", "b4"],
      ["b4", "b5"],
      ["b5", "rr"],
      ["b3", "stem"],
      ["stem", "baseL"],
      ["stem", "baseR"],
    ],
  },
  courage: {
    group: "courage",
    emotion: "courage",
    hostGalaxyId: "lmc",
    threshold: 10,
    anchors: [
      { id: "bL", r: 0.5188, angle: 2.5594 },
      { id: "s1", r: 0.2803, angle: 3.0073 },
      { id: "v1", r: 0.2346, angle: 2.3607 },
      { id: "summit", r: 0.3605, angle: -1.6016 },
      { id: "v2", r: 0.1169, angle: 0.0643 },
      { id: "s2", r: 0.2775, angle: 0.5718 },
      { id: "p2", r: 0.3465, angle: -0.1086 },
      { id: "bR", r: 0.5194, angle: 0.5643 },
      { id: "capL", r: 0.2032, angle: -1.9637 },
      { id: "capR", r: 0.1992, angle: -1.2295 },
    ],
    edges: [
      ["bL", "s1"],
      ["s1", "v1"],
      ["v1", "summit"],
      ["summit", "v2"],
      ["v2", "s2"],
      ["s2", "p2"],
      ["p2", "bR"],
      ["summit", "capL"],
      ["summit", "capR"],
      ["capL", "capR"],
    ],
  },
  pride: {
    group: "pride",
    emotion: "pride",
    hostGalaxyId: "lmc",
    threshold: 10,
    anchors: [
      { id: "baseL", r: 0.3529, angle: 2.4768 },
      { id: "lSpike", r: 0.3309, angle: -2.4532 },
      { id: "dipL", r: 0.1297, angle: -2.9671 },
      { id: "mSpike", r: 0.3754, angle: -1.5708 },
      { id: "dipR", r: 0.1297, angle: -0.1745 },
      { id: "rSpike", r: 0.3309, angle: -0.6883 },
      { id: "baseR", r: 0.3529, angle: 0.6648 },
      // jL/jM/jR — the crown's jewels: edge-less BY DESIGN (decorative filled dots inside
      // the outline, never part of the silhouette chain; pass the gate, isolated by intent).
      { id: "jL", r: 0.2045, angle: 2.3173 },
      { id: "jM", r: 0.1577, angle: 1.5708 },
      { id: "jR", r: 0.2045, angle: 0.8243 },
    ],
    edges: [
      ["baseL", "lSpike"],
      ["lSpike", "dipL"],
      ["dipL", "mSpike"],
      ["mSpike", "dipR"],
      ["dipR", "rSpike"],
      ["rSpike", "baseR"],
      ["baseR", "baseL"],
    ],
  },
  longing: {
    group: "longing",
    emotion: "longing",
    hostGalaxyId: "lmc",
    threshold: 10,
    anchors: [
      { id: "lBase", r: 0.4858, angle: 2.6243 },
      { id: "lTop", r: 0.4246, angle: -3.0353 },
      { id: "a1", r: 0.3305, angle: -2.67 },
      { id: "a2", r: 0.2737, angle: -2.1752 },
      { id: "apex", r: 0.2553, angle: -1.5708 },
      { id: "a4", r: 0.2737, angle: -0.9664 },
      { id: "a5", r: 0.3305, angle: -0.4716 },
      { id: "rTop", r: 0.4246, angle: -0.1063 },
      { id: "rBase", r: 0.4858, angle: 0.5173 },
      // far — the distant star the bridge reaches toward: edge-less BY DESIGN (the lone far
      // point across the span IS the "longing").
      { id: "far", r: 0.4955, angle: -1.5708 },
    ],
    edges: [
      ["lBase", "lTop"],
      ["lTop", "a1"],
      ["a1", "a2"],
      ["a2", "apex"],
      ["apex", "a4"],
      ["a4", "a5"],
      ["a5", "rTop"],
      ["rTop", "rBase"],
    ],
  },
} as const satisfies Record<Emotion, ConstellationFigure>;

// ── Mom's lone gold star — the ONLY hardcoded star (everything else from D1) ────
// Owner 2026-06-22: the seed carries ONLY Mom's dedication star; every other star is
// a real memory persisted in D1 (ADR-0012), merged in by `createD1Store`. For dev/demo,
// `scripts/prefill-stars.ts` seeds D1 with a handful of memories. Mom stays UNGROUPED
// (ADR-0010 §1 + the Mom's-star treatment 2026-06-06) — the gold dedication star never
// joins a mood constellation; her `name`/`text` resolve from the i18n catalog (no inline
// copy). Irina is the brightest of the whole sky (brightness 1, the unique max — #146),
// sits near bottom-centre (r 0.92, angle ≈ π/2), reserving the pale gold `#f5d6a0`.
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

/**
 * The seed sky a stranger inherits: ONLY Mom's lone gold dedication star. There is no
 * hardcoded corpus — every other star is a real memory from D1 (owner 2026-06-22),
 * merged in by `createD1Store`. SSR-safe + clock-free.
 */
export const buildSeedSky = (): GalaxySky => {
  const { copyKey, ...rest } = DEEP_STAR;
  const mom: MemoryStar = {
    ...rest,
    name: COPY[copyKey].name,
    text: COPY[copyKey].text,
  };
  return { backdrop: { ...DEFAULT_BACKDROP }, stars: [mom] };
};
