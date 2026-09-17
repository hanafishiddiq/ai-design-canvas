import { describe, expect, it } from "vitest";
import { defaultDirection, generateTokens } from "../foundations";
import type { DesignReference } from "../types";
import { validateSemanticReferencePlan, visionPlanToPage, type SemanticReferencePlan } from "../vision";

describe("semantic vision plans", () => {
  const reference: DesignReference = {
    id: "ref_1", name: "Dashboard", kind: "screenshot", mimeType: "image/webp", dataUrl: "data:image/webp;base64,x", createdAt: new Date(0).toISOString(),
    analysis: { width: 1440, height: 900, aspectRatio: 1.6, averageColor: "#101114", dominantColors: ["#101114", "#6366f1"], luminance: .12, contrast: "high" },
  };
  const plan: SemanticReferencePlan = {
    summary: "Dense analytics dashboard",
    visualDirection: { theme: "dark", density: "compact", radius: "soft", palette: ["#101114", "#6366f1"], notes: ["Compact hierarchy"] },
    screen: { name: "Analytics", background: "#101114", sections: [{ kind: "header", name: "Header", text: "", bounds: { x: .05, y: .05, width: .9, height: .12 }, layout: "horizontal", controls: [{ kind: "text", name: "Title", text: "Analytics", bounds: { x: .02, y: .2, width: .4, height: .5 }, emphasis: "high" }] }] },
  };

  it("validates and converts structured vision output into editable nodes", () => {
    expect(validateSemanticReferencePlan(plan)).toBe(true);
    const page = visionPlanToPage(plan, reference, generateTokens(defaultDirection));
    expect(page.name).toBe("Analytics");
    expect(page.nodes.some((node) => node.type === "frame")).toBe(true);
    expect(page.nodes.some((node) => node.parentId)).toBe(true);
    expect(page.nodes.find((node) => node.type === "text")?.text).toBe("Analytics");
  });
});
