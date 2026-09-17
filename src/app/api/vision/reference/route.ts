import { NextRequest, NextResponse } from "next/server";
import { SEMANTIC_REFERENCE_SCHEMA, validateSemanticReferencePlan } from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DATA_URL_CHARS = 3_000_000;
const DEFAULT_MODEL = "gpt-5.6-terra";

function outputText(body: Record<string, unknown>): string | null {
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
  if (!apiKey) return NextResponse.json({ error: "OpenAI vision is not configured on this deployment." }, { status: 503 });

  let input: { imageDataUrl?: unknown; kind?: unknown; referenceName?: unknown; productContext?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const imageDataUrl = typeof input.imageDataUrl === "string" ? input.imageDataUrl : "";
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageDataUrl)) return NextResponse.json({ error: "imageDataUrl must be a base64 image data URL." }, { status: 400 });
  if (imageDataUrl.length > MAX_DATA_URL_CHARS) return NextResponse.json({ error: "Reference image is too large for hosted vision analysis." }, { status: 413 });

  const kind = typeof input.kind === "string" ? input.kind.slice(0, 40) : "screenshot";
  const referenceName = typeof input.referenceName === "string" ? input.referenceName.slice(0, 160) : "Reference";
  const productContext = typeof input.productContext === "string" ? input.productContext.slice(0, 4000) : "";
  const model = process.env.OPENAI_VISION_MODEL || DEFAULT_MODEL;

  const prompt = [
    `Interpret this ${kind} as a product-design reference named ${JSON.stringify(referenceName)}.`,
    "Return a semantic reconstruction plan, not prose and not pixel-perfect HTML.",
    "Identify major UI regions, hierarchy, likely controls, approximate normalized bounds, layout direction, visual density, radius character, palette, and concise design observations.",
    "Bounds are relative to the full image, with x/y/width/height between 0 and 1. Bounds of controls are relative to their containing section.",
    "Use short, realistic text labels when text is legible or strongly implied. Do not invent brand claims or sensitive data.",
    "For sketches, preserve information architecture rather than visual polish. For screenshots, preserve hierarchy and composition without copying proprietary logos/assets.",
    productContext ? `Product context: ${productContext}` : "",
  ].filter(Boolean).join("\n");

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 8000,
      input: [{ role: "user", content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: imageDataUrl, detail: "high" },
      ] }],
      text: { format: { type: "json_schema", name: "semantic_ui_reference", strict: true, schema: SEMANTIC_REFERENCE_SCHEMA } },
    }),
  });

  const body = await openaiResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!openaiResponse.ok) {
    const message = body.error && typeof body.error === "object" && typeof (body.error as { message?: unknown }).message === "string"
      ? (body.error as { message: string }).message
      : `OpenAI Responses API returned ${openaiResponse.status}.`;
    return NextResponse.json({ error: message }, { status: openaiResponse.status });
  }

  const text = outputText(body);
  if (!text) return NextResponse.json({ error: "Vision provider returned no structured output." }, { status: 502 });
  let plan: unknown;
  try { plan = JSON.parse(text); }
  catch { return NextResponse.json({ error: "Vision provider returned invalid JSON." }, { status: 502 }); }
  if (!validateSemanticReferencePlan(plan)) return NextResponse.json({ error: "Vision provider output failed semantic validation." }, { status: 502 });

  return NextResponse.json({ plan, model, usage: body.usage || null }, { headers: { "cache-control": "no-store" } });
}
