import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const visionModel = process.env.OPENAI_VISION_MODEL || "gpt-5.6-terra";
  const editModel = process.env.OPENAI_EDIT_MODEL || visionModel;
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json({
    providers: {
      openai: {
        configured,
        model: visionModel,
        visionModel,
        editModel,
        vision: true,
        structuredOutputs: true,
        editProposals: true,
      },
    },
  }, { headers: { "cache-control": "no-store" } });
}
