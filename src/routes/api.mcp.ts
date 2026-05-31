import { createFileRoute } from "@tanstack/react-router";
import type { McpRequest } from "#/lib/mcp-server";
import { handleMcpMessage } from "#/lib/mcp-server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(
            {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error" },
            },
            400,
          );
        }

        // JSON-RPC batch or single message.
        if (Array.isArray(body)) {
          const responses = (
            await Promise.all(
              body.map((m) => handleMcpMessage(m as McpRequest)),
            )
          ).filter(Boolean);
          return responses.length === 0
            ? new Response(null, { status: 202 })
            : json(responses);
        }

        const response = await handleMcpMessage(body as McpRequest);
        return response === null
          ? new Response(null, { status: 202 })
          : json(response);
      },
      // MCP Streamable HTTP allows GET for server->client SSE; we don't push events.
      GET: () => new Response("Method Not Allowed", { status: 405 }),
    },
  },
});
