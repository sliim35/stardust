import { describe, expect, it } from "vitest";
import { handleMcpMessage, MCP_TOOLS } from "./mcp-server";

interface McpResponse {
  jsonrpc: string;
  id: unknown;
  result?: {
    tools?: { name: string; inputSchema: { type: string } }[];
    content?: { type: string; text: string }[];
    isError?: boolean;
    serverInfo?: { name: string; version: string };
    capabilities?: { tools?: unknown };
    protocolVersion?: string;
  };
  error?: { code: number; message: string };
}

const call = (msg: object) =>
  handleMcpMessage(msg) as Promise<McpResponse | null>;

describe("mcp-server", () => {
  it("responds to initialize with serverInfo and capabilities", async () => {
    const res = await call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    expect(res?.jsonrpc).toBe("2.0");
    expect(res?.id).toBe(1);
    expect(res?.result?.serverInfo?.name).toBeTruthy();
    expect(res?.result?.capabilities?.tools).toBeDefined();
    expect(typeof res?.result?.protocolVersion).toBe("string");
  });

  it("returns null for the initialized notification (no id)", async () => {
    const res = await call({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(res).toBeNull();
  });

  it("tools/list returns the four tools with JSON-Schema inputs", async () => {
    const res = await call({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const names = (res?.result?.tools ?? []).map((t) => t.name).sort();
    expect(names).toEqual([
      "get_page_markdown",
      "list_speakers",
      "list_talks",
      "search_site",
    ]);
    expect(MCP_TOOLS[0].inputSchema.type).toBe("object");
  });

  it("tools/call list_speakers returns a text content block", async () => {
    const res = await call({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "list_speakers", arguments: {} },
    });
    expect(res?.result?.content?.[0].type).toBe("text");
    expect(() =>
      JSON.parse(res?.result?.content?.[0].text ?? ""),
    ).not.toThrow();
  });

  it("tools/call get_page_markdown returns markdown text", async () => {
    const list = await call({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "list_speakers", arguments: {} },
    });
    const slug = JSON.parse(list?.result?.content?.[0].text ?? "[]")[0].slug;
    const res = await call({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "get_page_markdown",
        arguments: { path: `/speakers/${slug}` },
      },
    });
    expect(res?.result?.content?.[0].text).toContain("# ");
  });

  it("unknown method returns a -32601 error", async () => {
    const res = await call({ jsonrpc: "2.0", id: 6, method: "nope" });
    expect(res?.error?.code).toBe(-32601);
  });

  it("unknown tool returns an isError result", async () => {
    const res = await call({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "ghost", arguments: {} },
    });
    expect(res?.result?.isError).toBe(true);
  });
});
