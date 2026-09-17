import type { DesignProject, DesignReference } from "./types";
import type { SemanticReferencePlan } from "./vision";

export interface VisionProviderStatus {
  available: boolean;
  provider: string;
  model?: string;
  reason?: string;
}

export interface VisionProvider {
  status(): Promise<VisionProviderStatus>;
  analyze(reference: DesignReference, project: Pick<DesignProject, "name" | "prompt" | "designMd">): Promise<{ plan: SemanticReferencePlan; model: string; usage?: unknown }>;
}

export class HostedVisionProvider implements VisionProvider {
  async status(): Promise<VisionProviderStatus> {
    try {
      const response = await fetch("/api/ai/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const body = await response.json() as { providers?: { openai?: { configured?: boolean; model?: string } } };
      const openai = body.providers?.openai;
      return { available: Boolean(openai?.configured), provider: "openai", model: openai?.model, reason: openai?.configured ? undefined : "OPENAI_API_KEY is not configured on this deployment." };
    } catch (error) {
      return { available: false, provider: "openai", reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async analyze(reference: DesignReference, project: Pick<DesignProject, "name" | "prompt" | "designMd">) {
    const response = await fetch("/api/vision/reference", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: reference.dataUrl,
        kind: reference.kind,
        referenceName: reference.name,
        productContext: `${project.name}\n${project.prompt}\n\nDesign contract excerpt:\n${project.designMd.slice(0, 3000)}`,
      }),
    });
    const body = await response.json() as { error?: string; plan?: SemanticReferencePlan; model?: string; usage?: unknown };
    if (!response.ok || !body.plan || !body.model) throw new Error(body.error || `Vision analysis failed with ${response.status}.`);
    return { plan: body.plan, model: body.model, usage: body.usage };
  }
}
