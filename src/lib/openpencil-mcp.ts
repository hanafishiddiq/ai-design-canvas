import { projectToOpenPencilConversion } from "./openpencil-convert";
import type { DesignProject } from "./types";

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

export interface OpenPencilSyncReport {
  endpoint: string;
  verified: boolean;
  designMd: "synced" | "unsupported";
  variables: "synced" | "unsupported";
  components: number;
  screens: number;
  lint?: unknown;
  conversionStatus?: unknown;
  warnings: string[];
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

  /** Idempotently project this document into OpenPencil's official code-to-design tools. */
  async syncProject(project: DesignProject): Promise<OpenPencilSyncReport> {
    const status = await this.status();
    if (!status.reachable) throw new Error(status.error || "OpenPencil MCP is not reachable.");
    if (!status.verified) throw new Error(`MCP endpoint is not verified as openpencil-mcp: ${this.endpoint}`);
    const toolNames = new Set(status.tools.map((tool) => tool.name));
    const conversion = projectToOpenPencilConversion(project);
    const warnings: string[] = [];

    let designMd: OpenPencilSyncReport["designMd"] = "unsupported";
    if (toolNames.has("set_design_md")) {
      await this.callTool("set_design_md", { markdown: conversion.designMd });
      designMd = "synced";
    } else warnings.push("OpenPencil server does not expose set_design_md.");

    let variables: OpenPencilSyncReport["variables"] = "unsupported";
    if (toolNames.has("upsert_variables")) {
      await this.callTool("upsert_variables", {
        key: "tokens:ai-design-canvas",
        variables: conversion.variables,
        sourcePath: "ai-design-canvas/DESIGN.md",
        sourceHash: `${project.version}:${project.updatedAt}`,
      });
      variables = "synced";
    } else warnings.push("OpenPencil server does not expose upsert_variables.");

    let components = 0;
    if (toolNames.has("upsert_component")) {
      for (const component of conversion.components) {
        await this.callTool("upsert_component", component);
        components += 1;
      }
    } else if (conversion.components.length) warnings.push("OpenPencil server does not expose upsert_component.");

    let screens = 0;
    if (toolNames.has("upsert_screen")) {
      for (const screen of conversion.screens) {
        await this.callTool("upsert_screen", screen);
        screens += 1;
      }
    } else warnings.push("OpenPencil server does not expose upsert_screen.");

    const lint = toolNames.has("lint_document") ? await this.callTool("lint_document", {}) : undefined;
    const conversionStatus = toolNames.has("conversion_status") ? await this.callTool("conversion_status", {}) : undefined;
    if (!toolNames.has("save_document")) warnings.push("OpenPencil save_document is unavailable; headless persistence depends on its backing file mode.");
    return { endpoint: this.endpoint, verified: true, designMd, variables, components, screens, lint, conversionStatus, warnings };
  }
}

export function inferOpenPencilCapabilities(tools: McpToolDefinition[]) {
  const names = new Set(tools.map((tool) => tool.name));
  const hasAny = (...candidates: string[]) => candidates.some((name) => names.has(name));
  return {
    readNodes: hasAny("read_nodes", "batch_get", "get_node"),
    insertNodes: hasAny("insert_node", "batch_design", "design_skeleton", "upsert_screen"),
    updateNodes: hasAny("update_node", "batch_design", "design_content", "upsert_screen"),
    deleteNodes: hasAny("delete_node"),
    variables: hasAny("get_variables", "list_variables", "set_variables", "upsert_variables"),
    pages: hasAny("list_pages", "add_page", "rename_page"),
    codegen: [...names].some((name) => name.startsWith("codegen_")),
    styleGuides: hasAny("get_style_guide_tags", "get_style_guide", "list_style_guides"),
    screenshot: hasAny("get_screenshot", "export_item"),
    designMd: hasAny("get_design_md", "set_design_md", "export_design_md"),
    layeredDesign: hasAny("design_skeleton") && hasAny("design_content") && hasAny("design_refine"),
    conversionLedger: hasAny("conversion_status", "upsert_screen"),
  };
}
