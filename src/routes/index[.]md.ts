import { createFileRoute } from "@tanstack/react-router";
import { markdownResponse } from "#/lib/md-response";

export const Route = createFileRoute("/index.md")({
  server: {
    handlers: {
      GET: () => markdownResponse("/"),
    },
  },
});
