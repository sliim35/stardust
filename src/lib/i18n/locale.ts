/**
 * Locale resolution — the single source of truth (ADR-0007 §1, spec §1/§2).
 *
 * Every locale read in the app flows through `getLocale`, and `getLocale` reads
 * only the URL pathname. No `Accept-Language`, cookie, `Date`, or `Math.random`
 * is consulted, so the server and client derive a byte-identical locale and
 * hydration never mismatches (ACs 6/7). All exports here are pure — no React,
 * no I/O, no module-scope globals.
 *
 * URL policy: `en` is the default and unprefixed (`/`, `/galaxy`); `ru` lives
 * under `/ru/` (`/ru`, `/ru/galaxy`). No `/en/` prefix ever appears.
 */

export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/**
 * `ru` iff the path is `/ru` (exact) or under `/ru/`; else `en`. Pure, no I/O.
 *
 * The `(\/|$)` boundary is mandatory: a bare `startsWith("/ru")` would
 * false-match `/rubicon`, `/runner`, `/rust`. Case-sensitive on purpose — only
 * lowercase `/ru` is a locale; `/RU` is a normal (404) path.
 */
export const getLocale = (pathname: string): Locale =>
  /^\/ru(\/|$)/.test(pathname) ? "ru" : "en";

/**
 * History → router: drop the `/ru` segment so the single English route tree
 * matches. `/ru/galaxy` → `/galaxy`, `/ru` (and `/ru/`) → `/`. Non-ru paths are
 * returned unchanged.
 */
export const stripLocalePrefix = (pathname: string): string => {
  if (getLocale(pathname) === "en") return pathname;
  const stripped = pathname.slice("/ru".length);
  return stripped === "" || stripped === "/" ? "/" : stripped;
};

/**
 * Router → history: re-add the `/ru` prefix for `ru`. `/galaxy` → `/ru/galaxy`,
 * `/` → `/ru`. `en` is returned unchanged (no `/en/` prefix ever).
 */
export const addLocalePrefix = (pathname: string, locale: Locale): string => {
  if (locale === "en") return pathname;
  return pathname === "/" ? "/ru" : `/ru${pathname}`;
};
