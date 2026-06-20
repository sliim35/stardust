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
    /**
     * The product brand wordmark (owner rebrand 2026-06-10: Memory Galaxy →
     * Stardust). Stays the latin wordmark in every locale.
     */
    brand: string;
    srOnly: string;
    /**
     * The top-right wayfinding breadcrumb (interaction spec §5.3, #112) — the
     * live 3-tier trail `LOCAL GROUP › MILKY WAY › SOL`, one segment label per
     * `Tier`. The segment whose tier === the displayed tier is the active
     * (bright, `aria-current`) one; the other reachable tiers are clickable nav
     * (owner 2026-06-10). `solarSystem` is the deferred tier (#127) — never
     * active nor clickable in v1, shown as the dim reserved tail. Keys mirror
     * the `Tier` union (`lib/galaxy/types`).
     */
    breadcrumb: {
      localGroup: string;
      galaxy: string;
      solarSystem: string;
    };
    /** Accessible name of the breadcrumb `<nav>` (it is real navigation now). */
    breadcrumbNav: string;
    /** Carries the `{count}` placeholder — see `interpolate` in `index.ts`. */
    countLabel: string;
    /**
     * The backdrop theme switcher (owner redesign 2026-06-10; research note
     * `docs/research/2026-06-10-theme-switcher.md`): the group's accessible
     * name (the fieldset's sr-only legend — native radios, role `group`) + one
     * reveal-on-hover label per palette (keys mirror the `Palette` union — the
     * former hardcoded `PALETTE_LABELS`, now localized).
     */
    backdrop: {
      label: string;
      auroral: string;
      ember: string;
      ice: string;
    };
  };
  /** Accessibility labels for interactive galaxy elements (not visible copy). */
  a11y: {
    /** aria-label for an unnamed memory star's click target. */
    memoryStar: string;
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
    s07: MemoryStarCopy;
    s08: MemoryStarCopy;
    s09: MemoryStarCopy;
    s10: MemoryStarCopy;
    irina: MemoryStarCopy;
  };
  /**
   * Mood-constellation labels (Layer B — the one-word MOOD caption beside a group).
   * Keyed by the 12-wide `Emotion` union (ADR-0014 §1, the #187 widening: the
   * original 7 + `hope`/`gratitude`/`courage`/`pride`/`longing`) plus `memory`
   * (Mom's gold standalone star). The `wistful` caption was renamed off "LONGING"
   * so the new `longing` emotion owns it (#193-B).
   */
  moods: {
    joyful: string;
    tender: string;
    grieving: string;
    wistful: string;
    peaceful: string;
    nostalgic: string;
    wonder: string;
    hope: string;
    gratitude: string;
    courage: string;
    pride: string;
    longing: string;
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
    /**
     * The "what sparked this memory" chip (BR28 — `Trigger`). `person` labels a
     * memory triggered by someone; `action` labels one triggered by a moment/event.
     * Authored here in #193-B; the chip itself is rendered by #193-D.
     */
    trigger: {
      person: string;
      action: string;
    };
  };
  /**
   * The bottom-left scale net (interaction spec §5.3, #112) — the display-only
   * concentric range rings. The ring distance labels are formatted from authored
   * values (`scale-net.ts` `formatRingLabel`), not the catalog; only the net's own
   * accessible name lives here. `label` is the region's `aria-label` — it's a
   * decorative orientation device, so it gets one short SR-only name, not per-ring
   * announcements.
   */
  scaleNet: {
    /** The scale net region's accessible name (aria-label). */
    label: string;
  };
  /**
   * "Add your star" chat chrome (#183, ADR-0013 §3/§4) — the authored copy around
   * the AI mood→placement write path: the input affordance, the success
   * confirmation (flows through ASTRO's `narration` seam), and the `error.*`
   * messages a rejected submission shows. English-only MVP (ADR-0013 §4); the
   * `ru` block duplicates the English string as a tracked placeholder until #182.
   */
  chat: {
    /** The "Add your star" CTA in ASTRO's bubble that opens the composer. */
    open: string;
    /** The prompt shown above the textarea inside the bubble. */
    label: string;
    /** Textarea placeholder copy. */
    placeholder: string;
    /** Submit-button copy. */
    submit: string;
    /** Submit-button copy while the request is in flight (client-only state). */
    submitting: string;
    /** ASTRO's confirmation line after a star is saved (spoken in its bubble). */
    success: string;
    /** Rejection messages — keyed by the handler's `AddMemoryErrorKey`. */
    error: {
      /** Empty / whitespace-only submission. */
      empty: string;
      /** Over the max length. */
      tooLong: string;
      /** Flagged by the inline moderation gate. */
      flagged: string;
      /** The model could not classify the mood (a wrong mood is permanent). */
      unclear: string;
      /** A transport / unexpected failure (network, binding, model error). */
      failed: string;
    };
  };
  /**
   * The discovery star-search (#113) — the combobox that finds a memory star by
   * text / mood / colour and frames it (focus-on-star #111). All chrome here:
   * `label` names the region + the input; `placeholder` is the input hint; `clear`
   * is the reset
   * button's name; `results` names the listbox; `option` carries `{name}` for each
   * result's accessible name (interpolated); `count` carries `{count}` for the
   * live result-count announcement; `empty` is the no-results line. No visible copy
   * is hardcoded — every string is locale-resolved (#103, en+ru parity enforced).
   */
  search: {
    /** The search region + the text input's accessible name (aria-label). */
    label: string;
    /** Placeholder hint shown in the empty input. */
    placeholder: string;
    /** Accessible name of the in-input clear/reset button. */
    clear: string;
    /** Accessible name of the results listbox. */
    results: string;
    /** A single result's accessible name template — carries `{name}`. */
    option: string;
    /** The live result-count announcement — carries `{count}`. */
    count: string;
    /** Shown (and announced) when a query matches no stars. */
    empty: string;
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
