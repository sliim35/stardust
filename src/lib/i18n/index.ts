import { useRouterState } from "@tanstack/react-router";
import { getLocale, type Locale } from "#/lib/i18n/locale";
import { en } from "#/lib/i18n/messages/en";
import { ru } from "#/lib/i18n/messages/ru";
import type { Messages } from "#/lib/i18n/types";

/**
 * Catalog accessor + interpolation + the React locale hook (spec §1/§5).
 *
 * Components consume via `getMessages(useLocale())` and read keys by property
 * access (`m.chrome.forMom`) — chosen over a stringly-typed `t(key)` indexer for
 * full IntelliSense + compile-time key safety on the 8-key surface (spec §1).
 * `interpolate` is the only runtime helper. `useLocale` is the sole React export.
 */

/** Pure locale → dictionary lookup. No I/O. */
export const getMessages = (locale: Locale): Messages => ({ en, ru })[locale];

/**
 * Replace every `{key}` in `template` with `params[key]`. Pure; leaves unknown
 * `{tokens}` intact so a missing param never crashes or blanks the string.
 */
export const interpolate = (
  template: string,
  params: Record<string, string | number>,
): string =>
  template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match,
  );

/**
 * The active locale, derived from router state. Reads the **external** pathname
 * (`location.publicHref`, still `/ru`-prefixed), NOT `location.pathname` (the
 * internal, post-`input` stripped path — which would resolve every `ru` page as
 * `en`). This is the symmetric counterpart to `rewrite.output`'s source: both
 * read the external URL, so SSR and client agree (spec §5, AC6).
 */
export const useLocale = (): Locale =>
  useRouterState({
    select: (state) =>
      getLocale(new URL(state.location.publicHref, "http://x").pathname),
  });
