import { siteConfig } from "./site-config";
import {
  getPageMarkdown,
  listSpeakers,
  listTalks,
  searchSite,
} from "./site-content";

const PROTOCOL_VERSION = "2024-11-05";

export interface McpRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

export const MCP_TOOLS = [
  {
    name: "search_site",
    description: "Search this site's speakers and sessions by keyword.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search keyword" } },
      required: ["query"],
    },
  },
  {
    name: "list_speakers",
    description:
      "List all speakers (slug, name, specialty, restaurant, location).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_talks",
    description: "List all sessions (slug, title, speaker, duration, topics).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_page_markdown",
    description:
      'Get the clean markdown for a site path, e.g. "/speakers/<slug>".',
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Site-relative path" },
      },
      required: ["path"],
    },
  },
] as const;

const textResult = (data: unknown) => ({
  content: [
    {
      type: "text",
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    },
  ],
});

const callTool = (name: string, args: Record<string, unknown>) => {
  switch (name) {
    case "search_site":
      return textResult(searchSite(String(args.query ?? "")));
    case "list_speakers":
      return textResult(listSpeakers());
    case "list_talks":
      return textResult(listTalks());
    case "get_page_markdown": {
      const md = getPageMarkdown(String(args.path ?? ""));
      return md == null
        ? {
            content: [
              { type: "text", text: `No page at ${String(args.path)}` },
            ],
            isError: true,
          }
        : textResult(md);
    }
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
};

const ok = (id: McpRequest["id"], result: unknown) => ({
  jsonrpc: "2.0",
  id,
  result,
});
const err = (id: McpRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

/** Handle one JSON-RPC message. Returns a response object, or null for notifications. */
export async function handleMcpMessage(
  msg: McpRequest | null | undefined,
): Promise<object | null> {
  const id = msg?.id;
  const method = msg?.method;
  const params = msg?.params;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: `${siteConfig.name} MCP`, version: "1.0.0" },
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: MCP_TOOLS });
    case "tools/call":
      return ok(id, callTool(params?.name ?? "", params?.arguments ?? {}));
    default:
      if (isNotification) return null;
      return err(id, -32601, `Method not found: ${method}`);
  }
}
