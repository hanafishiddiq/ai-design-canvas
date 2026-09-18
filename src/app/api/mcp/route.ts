import { NextRequest, NextResponse } from "next/server";
import { callHeadlessTool, headlessToolDefinitions } from "@/lib/headless-tools";
import { corsHeaders, guardRequest, originAllowed } from "@/lib/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-11-25";
const SERVER_INFO = { name: "ai-design-canvas", version: "0.1.0" };
const MAX_BODY_BYTES = 2_000_000;

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
}

const rpcResult = (id: JsonRpcId, result: unknown, status = 200) => NextResponse.json({ jsonrpc: "2.0", id, result }, { status, headers: { "cache-control": "no-store" } });
const rpcError = (id: JsonRpcId, code: number, message: string, status = 400, data?: unknown) => NextResponse.json({ jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } }, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  return NextResponse.json({
    service: "AI Design Canvas MCP-compatible stateless endpoint",
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: SERVER_INFO,
    tools: headlessToolDefinitions.map((tool) => tool.name),
    note: "POST JSON-RPC requests to this endpoint. Project state is supplied by the caller and is not persisted server-side.",
  }, { headers: { "cache-control": "no-store" } });
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && !originAllowed(request, "ADC_MCP_ALLOW_ORIGINS")) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, "ADC_MCP_ALLOW_ORIGINS") });
}

export async function POST(request: NextRequest) {
  const denied = guardRequest(request, { scope: "mcp", maxRequests: 180, windowMs: 60_000, maxBodyBytes: MAX_BODY_BYTES, tokenEnv: "ADC_MCP_TOKEN", allowOriginsEnv: "ADC_MCP_ALLOW_ORIGINS", requireTokenWithoutOrigin: true });
  if (denied) return denied;
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return rpcError(null, -32600, "Request body exceeds the 2 MB stateless MCP limit.", 413);

  let message: JsonRpcRequest;
  try { message = await request.json(); }
  catch { return rpcError(null, -32700, "Parse error", 400); }

  const id = message.id ?? null;
  const isNotification = message.id === undefined;
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") return rpcError(id, -32600, "Invalid Request", 400);

  if (message.method === "notifications/initialized") return isNotification ? new NextResponse(null, { status: 204 }) : rpcResult(id, {});
  if (message.method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: "AI Design Canvas exposes stateless project tools. Supply the project JSON with each tool call; the server does not retain design state between requests.",
    });
  }
  if (message.method === "ping") return rpcResult(id, { _meta: { server: "ai-design-canvas-mcp", protocolVersion: PROTOCOL_VERSION }, ok: true });
  if (message.method === "tools/list") return rpcResult(id, { tools: headlessToolDefinitions });
  if (message.method === "tools/call") {
    const params = message.params && typeof message.params === "object" && !Array.isArray(message.params) ? message.params as Record<string, unknown> : {};
    const name = typeof params.name === "string" ? params.name : "";
    const args = params.arguments ?? {};
    if (!name) return rpcError(id, -32602, "tools/call requires params.name", 400);
    try {
      const result = await callHeadlessTool(name, args);
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result) }], isError: false });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      return rpcResult(id, { content: [{ type: "text", text }], isError: true });
    }
  }

  if (isNotification) return new NextResponse(null, { status: 204 });
  return rpcError(id, -32601, `Method not found: ${message.method}`, 404);
}
