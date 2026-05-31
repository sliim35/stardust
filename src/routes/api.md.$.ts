import { createFileRoute } from "@tanstack/react-router";
import { markdownResponse } from "#/lib/md-response";

// Universal plain-markdown endpoint: GET /api/md/<path>, e.g.
//   /api/md/speakers/andr-costa  ->  the speaker's markdown
// Used for dynamic pages because TanStack file routing can't express a
// "$slug.md" segment (the param name would be the invalid "slug.md").
export const Route = createFileRoute("/api/md/$")({
  server: {
    handlers: {
      GET: ({ params }) => markdownResponse(`/${params._splat ?? ""}`),
    },
  },
});
