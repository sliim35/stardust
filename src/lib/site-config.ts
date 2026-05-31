export const siteConfig = {
  url: "https://mdvoy.org",
  name: "mdvoy.org",
  description:
    "A TanStack Start playground exploring LLMO and self-hosted MCP — currently showcasing the Haute Pâtisserie 2026 demo content.",
  defaultOgImage: "/conference-logo.png",
  owner: {
    name: "Maksim Dvoinishnikov",
    url: "https://mdvoy.org",
    sameAs: [] as string[], // add social/profile URLs here
  },
} as const;

/** Resolve a site-relative path to an absolute URL (AI fetchers need fully-qualified URLs). */
export const absoluteUrl = (path: string): string =>
  new URL(path, siteConfig.url).toString();
