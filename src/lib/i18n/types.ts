/**
 * The message catalog shape (ADR-0007 §3, spec §1). `en` is the source-of-truth
 * shape; both dictionaries are typed `as const satisfies Messages`, so a missing
 * or extra key is a compile error (AC4/AC9).
 *
 * The shape is namespaced (`meta.*`, `chrome.*`) and carries an optional `astro?`
 * seam: a follow-up story can localize ASTRO narration by filling `astro` in
 * `messages/*.ts` (and optionally tightening this type) — touching neither
 * `rewrite.ts` nor `locale.ts` (AC10). `astro?` is optional so a missing block is
 * not a compile error today.
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
  /** AC10 seam — a narration follow-up fills this; resolution code is untouched. */
  astro?: Record<string, string>;
};
