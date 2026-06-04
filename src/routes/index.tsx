import { createFileRoute } from "@tanstack/react-router";
import { GalaxyWithLoader } from "#/components/galaxy/AstroLoader/GalaxyWithLoader";

const Home = () => <GalaxyWithLoader />;

// The page `<title>` and `<meta description>` are owned by the root route and
// driven by the active locale's catalog (#103). The index route deliberately
// sets no head meta: a duplicate `head()` here would shadow the root's localized
// tags (head dedup keeps the most-nested route's `title`/`name`'d meta), which
// would pin an un-localized title regardless of locale.
export const Route = createFileRoute("/")({
  component: Home,
});
