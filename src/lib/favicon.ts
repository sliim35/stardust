/**
 * The ASTRO favicon set (#80) — the STARLIGHT helmet pixel-art mark, not a star.
 *
 * The art assets (`favicon.svg`, `favicon-16/32/180/512.png`) are copied from
 * the gitignored `astro/favicon/` Claude Design handoff into `public/favicon/`
 * (committed art deliverables) and referenced here by their served `/favicon/…`
 * paths — never the `astro/` source. The route imports `FAVICON_LINKS` into its
 * `head().links` so the browser tab, bookmarks bar, and device home screen show
 * the ASTRO helmet, replacing the TanStack Start / Vite scaffold default.
 *
 * Order follows the convention "scalable first, raster fallback after": modern
 * browsers pick the SVG; older ones fall back to the 32/16 PNGs.
 */

type FaviconLink = {
  rel: "icon" | "apple-touch-icon" | "manifest";
  href: string;
  type?: string;
  sizes?: string;
};

export const FAVICON_LINKS = [
  { rel: "icon", type: "image/svg+xml", href: "/favicon/favicon.svg" },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/favicon/favicon-32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/favicon/favicon-16.png",
  },
  {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: "/favicon/favicon-180.png",
  },
  { rel: "manifest", href: "/site.webmanifest" },
] as const satisfies readonly FaviconLink[];
