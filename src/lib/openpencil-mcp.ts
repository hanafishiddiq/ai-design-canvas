export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface OpenPencilMcpStatus {
  reachable: boolean;
  verified: boolean;
  server?: string;
  tools: McpToolDefinition[];
  endpoint: string;
  error?: string;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc?: string;
  id?: string | number;
  result?: T;
  error?: { code?: number; message?: string; data?: unknown };
}

export class OpenPencilMcpClient {
  private nextId = 1;

  constructor(public readonly endpoint = "http://127.0.0.1:3100/mcp", private readonly token?: string) {}

  private async rpc<T>(method: string, params: unknown = null): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
    });
    if (!response.ok) throw new Error(`OpenPencil MCP HTTP ${response.status}`);
    const body = await response.json() as JsonRpcResponse<T>;
    if (body.error) throw new Error(body.error.message || `OpenPencil MCP error ${body.error.code ?? "unknown"}`);
    if (body.result === undefined) throw new Error("OpenPencil MCP returned no result.");
    return body.result;
  }

  async ping() {
    const result = await this.rpc<Record<string, unknown>>("ping");
    const meta = (result._meta && typeof result._meta === "object" ? result._meta : result) as Record<string, unknown>;
    return {
      server: typeof meta.server === "string" ? meta.server : undefined,
      raw: result,
      verified: meta.server === "openpencil-mcp",
    };
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.rpc<{ tools?: McpToolDefinition[] }>("tools/list");
    return Array.isArray(result.tools) ? result.tools : [];
  }

  async callTool<T = unknown>(name: string, argumentsObject: Record<string, unknown> = {}): Promise<T> {
    const result = await this.rpc<{ content?: Array<{ type?: string; text?: string }>; isError?: boolean }>("tools/call", {
      name,
      arguments: argumentsObject,
    });
    const text = (result.content || []).filter((block) => block.type === "text" || typeof block.text === "string").map((block) => block.text || "").join("\n");
    if (result.isError) throw new Error(text || `OpenPencil tool ${name} failed.`);
    if (!text) return result as unknown as T;
    try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
  }

  async status(): Promise<OpenPencilMcpStatus> {
    try {
      const ping = await this.ping();
      const tools = ping.verified ? await this.listTools() : [];
      return { reachable: true, verified: ping.verified, server: ping.server, tools, endpoint: this.endpoint };
    } catch (error) {
      return { reachable: false, verified: false, tools: [], endpoint: this.endpoint, error: error instanceof Error ? error.message : String(error) };
    }
  }

  hasTool(tools: McpToolDefinition[], ...names: string[]) {
    const set = new Set(tools.map((tool) => tool.name));
    return names.some((name) => set.has(name));
  }
}

export function inferOpenPencilCapabilities(tools: McpToolDefinition[]) {
  const names = new Set(tools.map((tool) => tool.name));
  const hasAny = (...candidates: string[]) => candidates.some((name) => names.has(name));
  return {
    readNodes: hasAny("read_nodes", "get_nodes", "get_node"),
    insertNodes: hasAny("insert_node", "batch_design", "design_skeleton"),
    updateNodes: hasAny("update_node", "batch_design", "design_content"),
    deleteNodes: hasAny("delete_node"),
    variables: hasAny("get_variables", "set_variables", "upsert_variables"),
    pages: hasAny("list_pages", "add_page", "rename_page"),
    codegen: [...names].some((name) => name.startsWith("codegen_")),
    styleGuides: hasAny("get_style_guide_tags", "get_style_guide"),
    screenshot: hasAny("take_screenshot", "screenshot"),
    layeredDesign: hasAny("design_skeleton") && hasAny("design_content") && hasAny("design_refine"),
  };
}
