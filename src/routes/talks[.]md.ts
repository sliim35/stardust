import { createFileRoute } from "@tanstack/react-router";
import { markdownResponse } from "#/lib/md-response";

export const Route = createFileRoute("/talks.md")({
  server: {
    handlers: {
      GET: () => markdownResponse("/talks"),
    },
  },
});
