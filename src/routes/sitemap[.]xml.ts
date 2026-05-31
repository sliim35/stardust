import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "#/lib/site-config";
import { getAllPages } from "#/lib/site-content";

const buildSitemap = (): string => {
  const urls = getAllPages()
    .map((p) => `  <url><loc>${absoluteUrl(p.path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemap(), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
