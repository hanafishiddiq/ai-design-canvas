import { projectToOpenPencilConversion } from "./openpencil-convert";
import { mergeOpenPencilPull, openPencilVariablesToCollections, penRootsToPages, reusablePenNodeToComponent, type OpenPencilPullResult } from "./openpencil-pull";
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
  /** Read the live/headless OpenPencil document and prepare an explicit loss-aware candidate project. */
  async pullProject(baseProject: DesignProject): Promise<OpenPencilPullResult> {
    const status = await this.status();
    if (!status.reachable) throw new Error(status.error || "OpenPencil MCP is not reachable.");
    if (!status.verified) throw new Error("Endpoint did not identify as openpencil-mcp.");
    const names = new Set(status.tools.map((tool) => tool.name));
    if (!names.has("list_pages") || !names.has("read_nodes")) throw new Error("OpenPencil pull requires list_pages and read_nodes.");

    const warnings: string[] = [];
    const losses: import("./openpencil-pull").OpenPencilLoss[] = [];
    const pageInfo = await this.callTool<{ pageCount?: number; activePageIndex?: number; pages?: Array<{ id?: string; name?: string }> }>("list_pages", {});
    const physicalPages = Array.isArray(pageInfo.pages) ? pageInfo.pages : [];
    const importedPages = [];
    let rawVariables: unknown = {};
    let rawThemes: unknown = {};

    for (const [index, page] of physicalPages.entries()) {
      const pageId = String(page.id || index);
      const content = await this.callTool<{ nodes?: unknown[]; variables?: unknown; themes?: unknown }>("read_nodes", { pageId, depth: -1, includeVariables: index === 0 });
      if (index === 0) { rawVariables = content.variables || {}; rawThemes = content.themes || {}; }
      importedPages.push(...penRootsToPages({ id: pageId, name: String(page.name || `Page ${index + 1}`) }, Array.isArray(content.nodes) ? content.nodes : [], baseProject.tokens.colors.background, losses));
    }

    let designMd: string | undefined;
    if (names.has("get_design_md")) {
      const result = await this.callTool<{ hasDesignMd?: string | boolean; markdown?: string }>("get_design_md", {});
      if (typeof result.markdown === "string" && result.markdown.trim()) designMd = result.markdown;
    } else warnings.push("get_design_md is unavailable; existing DESIGN.md was retained.");

    if (names.has("get_variables")) {
      const result = await this.callTool<{ variables?: unknown; themes?: unknown }>("get_variables", {});
      const parseMaybe = (value: unknown) => {
        if (typeof value !== "string") return value;
        try { return JSON.parse(value); } catch { return {}; }
      };
      rawVariables = parseMaybe(result.variables);
      rawThemes = parseMaybe(result.themes);
    }
    const collections = openPencilVariablesToCollections(rawVariables, rawThemes, losses);

    const components = [];
    if (names.has("batch_get")) {
      try {
        const reusable = await this.callTool<{ nodes?: unknown[] }>("batch_get", { patterns: [{ reusable: true }], readDepth: -1 });
        for (const node of reusable.nodes || []) {
          const component = reusablePenNodeToComponent(node, losses);
          if (component) components.push(component);
        }
      } catch (error) {
        warnings.push(`Reusable component pull failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else warnings.push("batch_get is unavailable; reusable OpenPencil component masters were not imported.");

    return mergeOpenPencilPull(baseProject, importedPages, components, collections, designMd, losses, warnings);
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
