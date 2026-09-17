import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const model = process.env.OPENAI_VISION_MODEL || "gpt-5.6-terra";
  return NextResponse.json({
    providers: {
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        model,
        vision: true,
        structuredOutputs: true,
      },
    },
  }, { headers: { "cache-control": "no-store" } });
}
