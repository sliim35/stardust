import { createFileRoute } from "@tanstack/react-router";
import { GalaxyWithLoader } from "#/components/galaxy/AstroLoader/GalaxyWithLoader";
import { validateDeepLinkSearch } from "#/lib/galaxy/deep-link";

const Home = () => {
  // The typed search (validated below) rides into the stage as the arrival
  // deep-link (#129); the stage consumes it once on mount.
  const search = Route.useSearch();
  return <GalaxyWithLoader deepLink={search} />;
};

// The page `<title>` and `<meta description>` are owned by the root route and
// driven by the active locale's catalog (#103). The index route deliberately
// sets no head meta: a duplicate `head()` here would shadow the root's localized
// tags (head dedup keeps the most-nested route's `title`/`name`'d meta), which
// would pin an un-localized title regardless of locale.
//
// `validateSearch` (TanStack Router, no new dependency) types the wayfinding
// deep-link params (`?at=galaxy:<id>` / `?at=system:<id>` / `?star=<id>`, #129).
// It is deliberately *permissive* — a malformed link drops the bad param and
// renders the default view, never a router 404 (deep-link AC3). The pure
// URL→camera mapping that consumes it lives in `lib/galaxy/deep-link`.
export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: validateDeepLinkSearch,
});
