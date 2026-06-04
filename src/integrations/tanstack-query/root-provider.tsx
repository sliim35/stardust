import { QueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { DEFAULT_LOCALE, getLocale, type Locale } from "#/lib/i18n/locale";

/**
 * Resolve the active locale once, from the **external** request URL, and put it
 * on the router context (#103). This is the spec §3 fallback for the
 * `publicHref`-vs-request-URL spike: during the very first SSR `beforeLoad`/head
 * pass the router's `location.publicHref` is still the *internal* (post-`input`,
 * `/ru`-stripped) path, so resolving locale from it there yields `en` for a
 * `/ru` page — and that wrong pass flushes into `<title>`/`<meta>` before the
 * external pass can correct it. Capturing the original request URL once gives
 * every downstream read site a single, correct, URL-pure locale.
 *
 * `createIsomorphicFn` splits the impl so the server-only `getRequestUrl` import
 * is tree-shaken out of the client bundle:
 * - server: `getRequestUrl()` — the original, still `/ru`-prefixed request href.
 * - client: `window.location.pathname` — also the external URL.
 * Both are pure functions of the same URL, so server and client agree → no
 * hydration mismatch.
 */
const resolveRequestLocale = createIsomorphicFn()
  .server((): Locale => getLocale(new URL(getRequestUrl()).pathname))
  .client((): Locale => getLocale(window.location.pathname));

export const getContext = () => {
  const queryClient = new QueryClient();

  return {
    queryClient,
    // One of the isomorphic branches always runs; `?? DEFAULT_LOCALE` only
    // satisfies the `Locale` (non-optional) context type for the impossible case.
    requestLocale: resolveRequestLocale() ?? DEFAULT_LOCALE,
  };
};
const TanstackQueryProvider = () => {};
export default TanstackQueryProvider;
