import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, siteConfig } from "#/lib/site-config";
import { getAllPages } from "#/lib/site-content";

// Static pages expose markdown at "<page>.md"; dynamic pages (speakers/talks)
// expose it under "/api/md/<path>" (TanStack file routing can't do "$slug.md").
// Dynamic pages (speakers/talks) expose markdown under "/api/md/<path>" because
// TanStack file routing can't express a "$slug.md" segment. Static pages use
// "<page>.md" (see the "Key pages" links below).
const dynamicMdUrl = (path: string) => absoluteUrl(`/api/md${path}`);

const buildLlmsTxt = (): string => {
  const pages = getAllPages();
  const section = (label: string, type: string) => {
    const items = pages
      .filter((p) => p.type === type)
      .map((p) => `- [${p.title}](${dynamicMdUrl(p.path)})`)
      .join("\n");
    return items ? `## ${label}\n\n${items}\n` : "";
  };
  return (
    `# ${siteConfig.name}\n\n` +
    `> ${siteConfig.description}\n\n` +
    "Markdown for static pages is available at `<page>.md`; for dynamic pages at `/api/md/<path>`.\n\n" +
    "## Key pages\n\n" +
    `- [Home](${absoluteUrl("/index.md")})\n` +
    `- [About](${absoluteUrl("/about.md")})\n` +
    `- [Speakers](${absoluteUrl("/speakers.md")})\n` +
    `- [Sessions](${absoluteUrl("/talks.md")})\n\n` +
    `${section("Speakers", "speaker")}\n${section("Sessions", "talk")}`
  );
};

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(buildLlmsTxt(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
