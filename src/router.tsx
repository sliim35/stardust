import {
  composeRewrites,
  createRouter as createTanStackRouter,
} from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { localeRewrite } from "#/lib/i18n/rewrite";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const context = getContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  // The rewrite needs the router (its `output` reads the active locale from the
  // router's current location), and the router needs the rewrite — resolve the
  // cycle by assigning it after construction. `rewrite` is read lazily per
  // navigation, so this is safe. `composeRewrites` keeps future rewrites
  // composable with no re-wiring (ADR-0007 §2, spec §4).
  router.update({
    context,
    rewrite: composeRewrites([localeRewrite(router)]),
  });

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
