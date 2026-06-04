import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Layout } from "#/components/Layout";
import TanStackQueryDevtools from "#/integrations/tanstack-query/devtools";
import { FAVICON_LINKS } from "#/lib/favicon";
import { getMessages } from "#/lib/i18n";
import type { Locale } from "#/lib/i18n/locale";
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
  /** Active locale, resolved once from the external request URL (#103). */
  requestLocale: Locale;
}

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  // The shell renders outside a normal route match, so it reads the locale that
  // `beforeLoad` resolved once (from the external URL) and threaded via context.
  // Because `beforeLoad` runs identically on server and client from the same URL,
  // `<html lang>` is correct in the initial SSR HTML, never patched after
  // hydration (AC7).
  const { locale } = Route.useRouteContext();
  return (
    <html lang={locale} className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <Layout>{children}</Layout>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRouteWithContext<MyRouterContext>()({
  // Thread the locale that `getContext()` resolved once from the external request
  // URL (#103, spec §3 fallback). We deliberately do NOT re-derive it from
  // `location.publicHref` here: during the first SSR `beforeLoad`/head pass that
  // value is still the internal (`/ru`-stripped) path, which would render `en`
  // head meta on a `/ru` page before the external pass can correct it. The
  // request-URL locale is correct on the very first pass, so `<title>`,
  // `<meta description>` and `<html lang>` are all deterministic at SSR
  // (AC6/AC7), with no hydration mismatch (server + client read the same URL).
  beforeLoad: ({ context }) => ({ locale: context.requestLocale }),
  head: ({ match }) => {
    const m = getMessages(match.context.locale);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: m.meta.title },
        { name: "description", content: m.meta.description },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        {
          rel: "preload",
          href: "/fonts/Nunito-Variable.woff2",
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
        ...FAVICON_LINKS,
      ],
    };
  },
  shellComponent: RootDocument,
});
