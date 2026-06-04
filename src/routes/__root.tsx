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
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
}

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" className="dark">
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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Memory Galaxy" },
      {
        name: "description",
        content:
          "A growing galaxy of memories — each star is a memory someone shared.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preload",
        href: "/fonts/Nunito-Variable.ttf",
        as: "font",
        type: "font/ttf",
        crossOrigin: "anonymous",
      },
      ...FAVICON_LINKS,
    ],
  }),
  shellComponent: RootDocument,
});
