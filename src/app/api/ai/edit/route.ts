import { NextRequest, NextResponse } from "next/server";
import { AI_EDIT_SCHEMA, validateAiEditProposal } from "@/lib/ai-edit";
import type { DesignNode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractOutputText(body: Record<string, unknown>) {
  if (typeof body.output_text === "string") return body.output_text;
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: unknown }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenAI editing is not configured on this deployment." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 250_000) return NextResponse.json({ error: "AI edit request is too large." }, { status: 413 });

  let body: { instruction?: unknown; page?: unknown; selectedNodeIds?: unknown; designMd?: unknown; tokens?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 2400) : "";
  if (!instruction) return NextResponse.json({ error: "Instruction is required." }, { status: 400 });
  if (!body.page || typeof body.page !== "object") return NextResponse.json({ error: "Page context is required." }, { status: 400 });
  const page = body.page as { id?: unknown; name?: unknown; width?: unknown; height?: unknown; nodes?: unknown };
  const nodes = Array.isArray(page.nodes) ? page.nodes.filter((node): node is DesignNode => !!node && typeof node === "object").slice(0, 160) : [];
  const selectedNodeIds = Array.isArray(body.selectedNodeIds) ? body.selectedNodeIds.filter((id): id is string => typeof id === "string").slice(0, 80) : [];
  const allowedIds = new Set(selectedNodeIds.length ? selectedNodeIds : nodes.map((node) => node.id));
  const scopedNodes = nodes.filter((node) => allowedIds.has(node.id));

  const compactNodes = scopedNodes.map((node) => ({
    id: node.id, type: node.type, name: node.name, text: node.text || "", parentId: node.parentId || null,
    x: node.x, y: node.y, width: node.width, height: node.height, style: node.style, layout: node.layout || null, constraints: node.constraints || null,
  }));
  const designMd = typeof body.designMd === "string" ? body.designMd.slice(0, 7000) : "";
  const model = process.env.OPENAI_EDIT_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-5.6-terra";

  const prompt = [
    "You are proposing bounded edits for a structured product-design canvas.",
    `User instruction: ${instruction}`,
    `Page: ${String(page.name || "Untitled")} (${Number(page.width) || 0}×${Number(page.height) || 0}).`,
    selectedNodeIds.length ? `Scope is strictly limited to these existing node IDs: ${selectedNodeIds.join(", ")}. You may also insert new nodes if needed, but do not edit/remove unselected existing nodes.` : "The whole supplied page is in scope.",
    "Return conservative semantic actions. Prefer localized edits over wholesale rewrites. Preserve component/layout intent unless the request explicitly changes it.",
    "For insert_node, nodeId must be null; the client creates a safe ID. For updates/removal, nodeId must exactly match a supplied in-scope ID.",
    "Use null for fields not relevant to an action. Colors must be hex or transparent. Do not output code, CSS strings, or arbitrary JSON patches.",
    `Design contract:\n${designMd}`,
    `Scoped node state:\n${JSON.stringify(compactNodes)}`,
  ].join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model, store: false, reasoning: { effort: "low" }, max_output_tokens: 7000,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: { format: { type: "json_schema", name: "design_edit_proposal", strict: true, schema: AI_EDIT_SCHEMA } },
    }),
  });
  const responseBody = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = responseBody.error && typeof responseBody.error === "object" && typeof (responseBody.error as { message?: unknown }).message === "string" ? (responseBody.error as { message: string }).message : `OpenAI Responses API returned ${response.status}.`;
    return NextResponse.json({ error: message }, { status: response.status });
  }
  const text = extractOutputText(responseBody);
  if (!text) return NextResponse.json({ error: "AI editor returned no structured output." }, { status: 502 });
  let proposal: unknown;
  try { proposal = JSON.parse(text); }
  catch { return NextResponse.json({ error: "AI editor returned invalid JSON." }, { status: 502 }); }
  if (!validateAiEditProposal(proposal)) return NextResponse.json({ error: "AI editor proposal failed semantic validation." }, { status: 502 });
  return NextResponse.json({ proposal, model, usage: responseBody.usage || null }, { headers: { "cache-control": "no-store" } });
}
