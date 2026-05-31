import { getPageMarkdown } from "./site-content";

/** Build a `text/markdown` Response for a site path, or a 404 if unknown. */
export const markdownResponse = (path: string): Response => {
  const md = getPageMarkdown(path);
  if (md == null) return new Response("Not found", { status: 404 });
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
