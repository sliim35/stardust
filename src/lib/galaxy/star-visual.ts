/**
 * Pure visual math for a memory star (#4) — the headless half of
 * `MemoryStarView`. Every rule the design spec pins to a number lives here so it
 * is unit-testable in node (`docs/design/2026-06-02-explorable-galaxy.md`
 * §"Bloom / flare / twinkle sizing", §"States"):
 *
 *  - bloom / flare / core sizing from `brightness`,
 *  - deterministic twinkle speed + phase derived from the star id (these are
 *    render-only and deliberately absent from the #2 data contract),
 *  - the egg's no-hover-label rule,
 *  - color pass-through — the agent owns `color`; the UI renders it verbatim.
 */

import { hashStr, mulberry32 } from "#/lib/galaxy/rng";
import type { MemoryStar, Mood } from "#/lib/galaxy/types";
import type { Messages } from "#/lib/i18n/types";

/**
 * Short mood labels for hover/eyebrow text (design spec mood table). The
 * **en-default fallback** only — the locale-aware label resolves through the i18n
 * `moods` catalog (`moodLabel(mood, m.moods)`). Kept so the pure helpers degrade
 * to English when called without a catalog (tests, SSR placeholder), never inline
 * in a component (ADR-0010 §2 / all-user-text-via-i18n).
 */
export const MOOD_LABELS = {
  joyful: "joy",
  tender: "love",
  grieving: "grief",
  wistful: "longing",
  peaceful: "peace",
  nostalgic: "memory",
  wonder: "wonder",
} as const satisfies Record<Mood, string>;

/** The i18n `moods` catalog slice — `getMessages(locale).moods`. */
type MoodCatalog = Messages["moods"];
/**
 * The i18n `memoryStars` catalog slice — `getMessages(locale).memoryStars`. The
 * locale-aware seam (ADR-0010 §2): seeded-corpus stars relabel per locale; a live
 * (agent-added) star keeps its own copy. The memory *text* resolver lives with the
 * card slice that renders it — `MemoryStarView` only needs the display *name*.
 */
type MemoryStarCatalog = Messages["memoryStars"];

/**
 * The locale-aware mood caption (Layer B i18n consumption — ADR-0010 §2, the
 * Wave-1-A hook). Resolves `mood` against the passed `moods` catalog
 * (`getMessages(locale).moods`); falls back to the en `MOOD_LABELS` table when no
 * catalog is supplied so pure callers (tests / SSR) stay English-safe. Pure — the
 * component injects the catalog from `getMessages(useLocale())`, keeping this
 * node-testable and React-free.
 */
export const moodLabel = (mood: Mood, catalog?: MoodCatalog): string =>
  catalog?.[mood] ?? MOOD_LABELS[mood];

/** True iff a star id is a seeded-corpus key with a catalog entry. */
const isSeedKey = (
  id: string,
  catalog: MemoryStarCatalog,
): id is keyof MemoryStarCatalog => id in catalog;

/**
 * The locale-aware display name for a star (Layer B i18n) — `null` for the egg,
 * which stays anonymous (AC6), and `null` when no name resolves. Seeded-corpus
 * stars resolve their `name` from the catalog; a user-added star keeps its own
 * `name`. Pure; the locale-aware counterpart of `hoverLabelFor`'s name branch.
 */
export const resolveStarName = (
  star: MemoryStar,
  catalog: MemoryStarCatalog,
): string | null => {
  if (star.egg) return null;
  if (isSeedKey(star.id, catalog)) return catalog[star.id].name;
  return star.name ?? null;
};

export type BloomSizing = {
  bloom: number; // soft radial halo diameter (px)
  flareW: number; // horizontal lens-flare width
  vFlareH: number; // vertical lens-flare height
  hot: number; // white-hot center diameter
  core: number; // crisp core pixel size
};

/** Bloom / flare / core sizing for a star, optionally in its active (hover/selected) state. */
export const bloomSizing = (star: MemoryStar, active = false): BloomSizing => {
  const b = star.brightness;
  const bloom = (star.egg ? 15 : 13 + b * 11) * (active ? 1.3 : 1);
  const flareW = bloom * 2.5;
  return {
    bloom,
    flareW,
    vFlareH: flareW * 0.46,
    hot: bloom * 0.5,
    core: Math.max(2, 2 + b * 2),
  };
};

/**
 * Twinkle speed + phase for a star. Render-only, so derived deterministically
 * from the id (same star always twinkles the same way) rather than carried in
 * the data contract.
 */
export const animSeed = (id: string): { twinkle: number; phase: number } => {
  const rng = mulberry32(hashStr(id));
  return { twinkle: 0.6 + rng() * 1.8, phase: rng() };
};

export type TwinkleParams = {
  period: number; // seconds
  delay: number; // seconds
  kind: "twinkle" | "egg";
};

/** Animation timing for a star — the slow egg pulse, or a calm derived twinkle. */
export const twinkleParams = (star: MemoryStar): TwinkleParams => {
  if (star.egg) return { period: 5.5, delay: 0, kind: "egg" };
  const { twinkle, phase } = animSeed(star.id);
  return {
    period: Math.max(1.4, 3.6 / twinkle),
    delay: phase * 0.3,
    kind: "twinkle",
  };
};

/** The hover label for a star — `null` for the egg, which stays anonymous (AC6). */
export const hoverLabelFor = (star: MemoryStar): string | null => {
  if (star.egg) return null;
  return star.name ?? MOOD_LABELS[star.mood];
};

/** The agent's color, untouched. The UI never recolors a star. */
export const starColor = (star: MemoryStar): string => star.color;

/** Soft radial halo gradient using the star color exactly (AC2). */
export const haloGradient = (color: string): string =>
  `radial-gradient(circle, ${color}bb 0%, ${color}30 32%, ${color}10 50%, transparent 68%)`;
