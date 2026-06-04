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
  /**
   * ASTRO narration (#72 copy, localized in #103). `greeting` is the auto-greet
   * line; `clickLines` is the re-speak rotation — addressed by index via
   * `nextClickIndex` (lib/galaxy/astro-voice), so the rotation is locale-agnostic.
   */
  astro: {
    greeting: string;
    clickLines: readonly string[];
  };
};
