/**
 * The message catalog shape (ADR-0007 §3, spec §1). `en` is the source-of-truth
 * shape; both dictionaries are typed `as const satisfies Messages`, so a missing
 * or extra key is a compile error (AC4/AC9).
 *
 * The shape is namespaced (`meta.*`, `chrome.*`, `astro.*`). `astro` was the AC10
 * seam: it is now filled (ASTRO narration localized, folded into #103) without
 * touching `rewrite.ts` or `locale.ts` — exactly the seam's promise. Making it
 * required enforces en/ru parity for the narration too. The galaxy narration may
 * later become AI-generated per-locale; until then these are static lines.
 */
export type Messages = {
  meta: {
    title: string;
    description: string;
  };
  chrome: {
    forMom: string;
    subtitle: string;
    srOnly: string;
    breadcrumbMilkyWay: string;
    breadcrumbSolEarth: string;
    /** Carries the `{count}` placeholder — see `interpolate` in `index.ts`. */
    countLabel: string;
  };
  /** ASTRO loading screen (#79), localized in #103. */
  loader: {
    /** The italic word above the progress track (followed by animated dots). */
    thinking: string;
    /** The mono sub-label under the sprite (default copy; per-call overridable). */
    label: string;
  };
  /**
   * ASTRO narration (#72 copy, localized in #103). `greeting` is the auto-greet
   * line; `clickLines` is the re-speak rotation — addressed by index via
   * `nextClickIndex` (lib/galaxy/astro-voice), so the rotation is locale-agnostic.
   */
  astro: {
    greeting: string;
    clickLines: readonly string[];
  };
  /**
   * Layer-A real-object lore (ADR-0010 §4). One entry per `RealObject.loreKey`:
   * `name` (the display name), `sublabel` (catalogue + real distance, mono), and
   * `line` (ASTRO's curated, factual lore line — the post-v1 ASTRO-AI swap-seam).
   * Keys are compile-locked to the dataset via `LoreKey = keyof Messages["lore"]`.
   */
  lore: {
    milkyWay: LoreEntry;
    sol: LoreEntry;
    sgrA: LoreEntry;
    orionArm: LoreEntry;
    pillars: LoreEntry;
    crab: LoreEntry;
    orion: LoreEntry;
    lmc: LoreEntry;
    smc: LoreEntry;
    andromeda: LoreEntry;
    triangulum: LoreEntry;
    m32: LoreEntry;
    m110: LoreEntry;
  };
  /**
   * ASTRO's guided-journey narration (ADR-0010 §4, interaction spec §1). HARDCODED,
   * hand-curated for v1 — NOT generated; this is exactly the seam the post-v1
   * ASTRO-AI replaces. `onArrival` fires when a tier settles; `descend` / `ascend`
   * fire as the camera eases between tiers.
   */
  astroNarration: {
    onArrival: {
      localGroup: string;
      galaxy: string;
      solarSystem: string;
    };
    descend: {
      toGalaxy: string;
      toSolarSystem: string;
    };
    ascend: {
      toGalaxy: string;
      toLocalGroup: string;
    };
  };
  /**
   * Layer-B memory-star copy — the seeded/fake memory corpus (`seed.ts`). One entry
   * per seed star id: `name` (hover title) + `text` (the memory). Keys mirror the
   * seed-corpus ids so `buildSeedSky` resolves them with no inline strings.
   */
  memoryStars: {
    s01: MemoryStarCopy;
    s02: MemoryStarCopy;
    s03: MemoryStarCopy;
    s04: MemoryStarCopy;
    s05: MemoryStarCopy;
    s06: MemoryStarCopy;
    irina: MemoryStarCopy;
    egg: MemoryStarCopy;
  };
  /**
   * Mood-constellation labels (Layer B — the one-word MOOD caption beside a group).
   * Keyed by `Mood` + `memory` (Mom's gold standalone star).
   */
  moods: {
    joyful: string;
    tender: string;
    grieving: string;
    wistful: string;
    peaceful: string;
    nostalgic: string;
    wonder: string;
    memory: string;
  };
  /**
   * Card chrome (interaction spec §4, #146/#5) — the soft-glass panel's own labels,
   * *not* the object copy (lore lines live in `lore.*`, memory text on the star). The
   * lore card's `fieldLog` eyebrow is ASTRO's "FIELD LOG" voice; `close` is the
   * dismiss-button accessible name (aria-label / sr-only). Object content is never
   * here — only the chrome around it.
   */
  card: {
    /** Lore-card eyebrow — ASTRO's "FIELD LOG" register above the object name. */
    fieldLog: string;
    /** Dismiss-button accessible name (aria-label / sr-only). */
    close: string;
  };
};

/** A real-object lore entry — name + mono sublabel + ASTRO's lore line. */
export type LoreEntry = {
  name: string;
  sublabel: string;
  line: string;
};

/** A seeded memory star's user-facing copy — hover title + the memory text. */
export type MemoryStarCopy = {
  name: string;
  text: string;
};
