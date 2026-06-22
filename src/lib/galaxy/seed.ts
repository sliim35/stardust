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

// The 12 emotion figures (owner's Claude Design) — corner-placed per host galaxy, anchors
// inverted with the host's tilt → neighbours need per-host tilt at render (#234).
const RAW_CONSTELLATIONS = {
  joyful: {
    group: "joyful",
    emotion: "joyful",
    hostGalaxyId: "home",
    threshold: 10,
    anchors: [
      { id: "m0", r: 1.6339, angle: -2.62 },
      { id: "m1", r: 1.4826, angle: -2.6871 },
      { id: "m2", r: 1.3251, angle: -2.7287 },
      { id: "m3", r: 1.1717, angle: -2.7297 },
      { id: "m4", r: 1.0383, angle: -2.6728 },
      { id: "m5", r: 0.9492, angle: -2.5469 },
      { id: "m6", r: 0.9326, angle: -2.3692 },
      { id: "m7", r: 1.0015, angle: -2.1925 },
      { id: "eye-l", r: 1.5616, angle: -2.4509 },
      { id: "eye-r", r: 1.2743, angle: -2.2458 },
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
      { id: "t", r: 1.4222, angle: -0.791 },
      { id: "ru", r: 1.6658, angle: -0.7893 },
      { id: "ro", r: 1.6876, angle: -0.6695 },
      { id: "rm", r: 1.5711, angle: -0.5574 },
      { id: "rl", r: 1.3224, angle: -0.4455 },
      { id: "b", r: 1.0389, angle: -0.2744 },
      { id: "ll", r: 0.9876, angle: -0.615 },
      { id: "lm", r: 1.0654, angle: -0.8947 },
      { id: "lo", r: 1.2469, angle: -0.9972 },
      { id: "lu", r: 1.4427, angle: -0.9607 },
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
      { id: "tip", r: 1.0389, angle: 2.8672 },
      { id: "r1", r: 1.048, angle: 2.5871 },
      { id: "r2", r: 1.144, angle: 2.3602 },
      { id: "r3", r: 1.3219, angle: 2.2618 },
      { id: "rb", r: 1.463, angle: 2.2466 },
      { id: "b", r: 1.5486, angle: 2.2728 },
      { id: "lb", r: 1.5748, angle: 2.3308 },
      { id: "l3", r: 1.5419, angle: 2.42 },
      { id: "l2", r: 1.4353, angle: 2.5456 },
      { id: "l1", r: 1.2388, angle: 2.6799 },
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
      { id: "o0", r: 2.3109, angle: -2.0183 },
      { id: "i0", r: 1.744, angle: -2.123 },
      { id: "o1", r: 1.6135, angle: -1.9851 },
      { id: "i1", r: 1.3972, angle: -2.2359 },
      { id: "o2", r: 0.9272, angle: -2.5771 },
      { id: "i2", r: 1.3197, angle: -2.4306 },
      { id: "o3", r: 1.3138, angle: -2.7545 },
      { id: "i3", r: 1.5821, angle: -2.3733 },
      { id: "o4", r: 2.0014, angle: -2.3115 },
      { id: "i4", r: 1.839, angle: -2.2019 },
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
    // Open spiral (Claude Design "Figure Reference Sheet", #239): wide outside winding
    // inward, never closing — drawn tall so Andromeda's 0.42 tilt doesn't flatten it.
    anchors: [
      { id: "n1", r: 2.3545, angle: -1.0838 },
      { id: "n2", r: 1.6352, angle: -1.2611 },
      { id: "n3", r: 1.128, angle: -0.9645 },
      { id: "n4", r: 1.3951, angle: -0.6028 },
      { id: "n5", r: 1.8115, angle: -0.6531 },
      { id: "n6", r: 1.9479, angle: -0.8211 },
      { id: "n7", r: 1.8074, angle: -0.9495 },
      { id: "n8", r: 1.5822, angle: -0.9532 },
      { id: "n9", r: 1.5002, angle: -0.8474 },
      { id: "n10", r: 1.5959, angle: -0.7744 },
    ],
    edges: [
      ["n1", "n2"],
      ["n2", "n3"],
      ["n3", "n4"],
      ["n4", "n5"],
      ["n5", "n6"],
      ["n6", "n7"],
      ["n7", "n8"],
      ["n8", "n9"],
      ["n9", "n10"],
    ],
  },
  hope: {
    group: "hope",
    emotion: "hope",
    hostGalaxyId: "andromeda",
    threshold: 10,
    // Sprout (Claude Design "Figure Reference Sheet", #239): a stem rising from a low base
    // with two leaves curving UP — growth, not the anchor it used to read as.
    anchors: [
      { id: "n1", r: 2.3582, angle: 2.0087 },
      { id: "n2", r: 2.0428, angle: 2.0824 },
      { id: "n3", r: 1.755, angle: 2.1771 },
      { id: "n4", r: 1.5236, angle: 2.2868 },
      { id: "n5", r: 1.8613, angle: 2.2935 },
      { id: "n6", r: 1.7925, angle: 2.4677 },
      { id: "n7", r: 1.5389, angle: 2.587 },
      { id: "n8", r: 1.5937, angle: 2.0742 },
      { id: "n9", r: 1.2691, angle: 2.0627 },
      { id: "n10", r: 1.0656, angle: 2.2774 },
    ],
    edges: [
      ["n1", "n2"],
      ["n2", "n3"],
      ["n3", "n4"],
      ["n3", "n5"],
      ["n5", "n6"],
      ["n6", "n7"],
      ["n3", "n8"],
      ["n8", "n9"],
      ["n9", "n10"],
    ],
  },
  peaceful: {
    group: "peaceful",
    emotion: "peaceful",
    hostGalaxyId: "triangulum",
    threshold: 10,
    // Crescent moon (Claude Design "Figure Reference Sheet", #239): big outer rim + smaller
    // inner bite, a clear C — not the symmetric leaf/eye it used to read as (no centre vein).
    anchors: [
      { id: "n1", r: 1.2081, angle: -2.281 },
      { id: "n2", r: 1.3431, angle: -2.4383 },
      { id: "n3", r: 1.3851, angle: -2.616 },
      { id: "n4", r: 1.3021, angle: -2.7885 },
      { id: "n5", r: 1.1299, angle: -2.8942 },
      { id: "n6", r: 0.8217, angle: -2.8887 },
      { id: "n7", r: 0.965, angle: -2.7905 },
      { id: "n8", r: 1.1426, angle: -2.6986 },
      { id: "n9", r: 1.2271, angle: -2.5704 },
      { id: "n10", r: 1.2019, angle: -2.4247 },
    ],
    edges: [
      ["n1", "n2"],
      ["n2", "n3"],
      ["n3", "n4"],
      ["n4", "n5"],
      ["n5", "n6"],
      ["n6", "n7"],
      ["n7", "n8"],
      ["n8", "n9"],
      ["n9", "n10"],
      ["n10", "n1"],
    ],
  },
  wistful: {
    group: "wistful",
    emotion: "wistful",
    hostGalaxyId: "triangulum",
    threshold: 10,
    // Feather (Claude Design "Figure Reference Sheet", #239): a diagonal spine with barbs off
    // BOTH sides for real vertical spread — not the flat horizontal wave it used to read as.
    anchors: [
      { id: "n1", r: 0.7933, angle: -0.3169 },
      { id: "n2", r: 0.9889, angle: -0.4643 },
      { id: "n3", r: 1.2058, angle: -0.5581 },
      { id: "n4", r: 1.43, angle: -0.6229 },
      { id: "n5", r: 0.9193, angle: -0.6398 },
      { id: "n6", r: 1.1665, angle: -0.7105 },
      { id: "n7", r: 1.4008, angle: -0.7437 },
      { id: "n8", r: 1.0821, angle: -0.3086 },
      { id: "n9", r: 1.2926, angle: -0.4247 },
      { id: "n10", r: 1.5083, angle: -0.51 },
    ],
    edges: [
      ["n1", "n2"],
      ["n2", "n3"],
      ["n3", "n4"],
      ["n2", "n5"],
      ["n3", "n6"],
      ["n4", "n7"],
      ["n2", "n8"],
      ["n3", "n9"],
      ["n4", "n10"],
    ],
  },
  gratitude: {
    group: "gratitude",
    emotion: "gratitude",
    hostGalaxyId: "triangulum",
    threshold: 10,
    anchors: [
      { id: "rl", r: 1.4118, angle: 2.9769 },
      { id: "b1", r: 1.4025, angle: 2.7961 },
      { id: "b2", r: 1.3532, angle: 2.6341 },
      { id: "b3", r: 1.2314, angle: 2.5185 },
      { id: "b4", r: 1.0491, angle: 2.464 },
      { id: "b5", r: 0.8298, angle: 2.5321 },
      { id: "rr", r: 0.6499, angle: 2.7774 },
      { id: "stem", r: 1.353, angle: 2.4025 },
      { id: "baseL", r: 1.531, angle: 2.4535 },
      { id: "baseR", r: 1.2701, angle: 2.2699 },
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
      { id: "bL", r: 1.4786, angle: -2.8511 },
      { id: "s1", r: 1.4296, angle: -2.6615 },
      { id: "v1", r: 1.2805, angle: -2.7077 },
      { id: "summit", r: 1.4523, angle: -2.343 },
      { id: "v2", r: 1.1264, angle: -2.4835 },
      { id: "s2", r: 0.9557, angle: -2.525 },
      { id: "p2", r: 0.9947, angle: -2.3147 },
      { id: "bR", r: 0.7251, angle: -2.5056 },
      { id: "capL", r: 1.3879, angle: -2.459 },
      { id: "capR", r: 1.2838, angle: -2.3912 },
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
      { id: "baseL", r: 0.6502, angle: -0.4575 },
      { id: "lSpike", r: 1.1151, angle: -0.9848 },
      { id: "dipL", r: 1.0357, angle: -0.6754 },
      { id: "mSpike", r: 1.5443, angle: -0.8664 },
      { id: "dipR", r: 1.3562, angle: -0.4977 },
      { id: "rSpike", r: 1.6664, angle: -0.5914 },
      { id: "baseR", r: 1.4455, angle: -0.2 },
      // jL/jM/jR — the crown's jewels: edge-less BY DESIGN (decorative filled dots inside
      // the outline, never part of the silhouette chain; pass the gate, isolated by intent).
      { id: "jL", r: 0.8819, angle: -0.4562 },
      { id: "jM", r: 1.0688, angle: -0.3607 },
      { id: "jR", r: 1.2693, angle: -0.3111 },
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
      { id: "lBase", r: 1.7905, angle: 2.4836 },
      { id: "lTop", r: 1.6336, angle: 2.6203 },
      { id: "a1", r: 1.4729, angle: 2.6388 },
      { id: "a2", r: 1.3171, angle: 2.6379 },
      { id: "apex", r: 1.1693, angle: 2.5967 },
      { id: "a4", r: 1.0586, angle: 2.4975 },
      { id: "a5", r: 1.0035, angle: 2.356 },
      { id: "rTop", r: 1.001, angle: 2.1929 },
      { id: "rBase", r: 1.2407, angle: 2.0603 },
      // far — the distant star the bridge reaches toward: edge-less BY DESIGN (the lone far
      // point across the span IS the "longing").
      { id: "far", r: 1.0659, angle: 2.7881 },
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

/**
 * Owner 2026-06-22 (#239): pull every figure toward the disk centre. `polarToXY` is linear
 * in `r`, so scaling each anchor's `r` by a constant is a pure scale-about-centre — a figure
 * moves inward (and shrinks proportionally) without changing its shape, angles, edges, or
 * host galaxy, so the BR30 gate-1 structural test stays green.
 */
const FIGURE_CENTER_PULL = 0.62;
const pullToCentre = (figure: ConstellationFigure): ConstellationFigure => ({
  ...figure,
  anchors: figure.anchors.map((a) => ({
    ...a,
    r: +(a.r * FIGURE_CENTER_PULL).toFixed(4),
  })),
});
// `Object.fromEntries` is typed to a string index signature, so the Emotion-keyed shape is
// re-asserted through `unknown` (RAW_CONSTELLATIONS already satisfies the same Record).
export const CONSTELLATIONS = Object.fromEntries(
  Object.entries(RAW_CONSTELLATIONS).map(([emotion, figure]) => [
    emotion,
    pullToCentre(figure),
  ]),
) as unknown as Record<Emotion, ConstellationFigure>;

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
