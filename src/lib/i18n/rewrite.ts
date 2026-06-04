import type { AnyRouter, LocationRewrite } from "@tanstack/react-router";
import {
  addLocalePrefix,
  getLocale,
  type Locale,
  stripLocalePrefix,
} from "#/lib/i18n/locale";

/**
 * The `/ru` URL-localization rewrite (ADR-0007 §2, spec §3). A factory that
 * closes over the router, because `output` needs the router's *current*
 * location to know the active locale — that locale is NOT in the (internal,
 * already-stripped) URL `output` receives.
 *
 * Both halves are pure, total functions of the URL: `input` strips `/ru` for
 * route matching; `output` re-adds `/ru` iff the active locale is `ru`. No
 * `Date`/random/headers — the URL is the only locale signal (ACs 6/7).
 */

/**
 * The active locale — read from the router's **external** current href
 * (`latestLocation.publicHref`, still `/ru`-prefixed), per spec §3. This is the
 * one deliberate divergence from TanStack's docs example (which reads
 * `localStorage` — that would break SSR + the URL-purity invariant).
 */
const activeLocale = (router: AnyRouter): Locale =>
  getLocale(new URL(router.latestLocation.publicHref, "http://x").pathname);

export const localeRewrite = (router: AnyRouter): LocationRewrite => ({
  // history → router: drop the /ru segment so the English route tree matches.
  input: ({ url }) => {
    const stripped = stripLocalePrefix(url.pathname);
    if (stripped === url.pathname) return undefined; // en — no-op
    url.pathname = stripped;
    return url; // /ru/galaxy → /galaxy, /ru → /
  },
  // router → history: re-add /ru ONLY when the active locale is ru.
  output: ({ url }) => {
    if (activeLocale(router) === "en") return undefined; // en hrefs byte-identical
    url.pathname = addLocalePrefix(url.pathname, "ru");
    return url; // /galaxy → /ru/galaxy (search + hash preserved by URL)
  },
});
