import type { DesignNode, DesignPage, DesignReference, DesignTokens } from "./types";

export type SemanticRegionKind = "navigation" | "header" | "hero" | "content" | "card" | "list" | "form" | "footer" | "sidebar" | "media";
export type SemanticControlKind = "text" | "button" | "input" | "card" | "divider";

export interface NormalizedBounds { x: number; y: number; width: number; height: number }
export interface SemanticControl { kind: SemanticControlKind; name: string; text: string; bounds: NormalizedBounds; emphasis: "low" | "medium" | "high" }
export interface SemanticSection { kind: SemanticRegionKind; name: string; text: string; bounds: NormalizedBounds; layout: "absolute" | "horizontal" | "vertical"; controls: SemanticControl[] }
export interface SemanticReferencePlan {
  summary: string;
  visualDirection: { theme: "light" | "dark" | "mixed"; density: "compact" | "balanced" | "comfortable"; radius: "sharp" | "soft" | "rounded"; palette: string[]; notes: string[] };
  screen: { name: string; background: string; sections: SemanticSection[] };
}

const boundsSchema = {
  type: "object", additionalProperties: false,
  properties: {
    x: { type: "number", minimum: 0, maximum: 1 }, y: { type: "number", minimum: 0, maximum: 1 },
    width: { type: "number", minimum: 0.01, maximum: 1 }, height: { type: "number", minimum: 0.01, maximum: 1 },
  }, required: ["x", "y", "width", "height"],
};

export const SEMANTIC_REFERENCE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    summary: { type: "string" },
    visualDirection: {
      type: "object", additionalProperties: false,
      properties: {
        theme: { type: "string", enum: ["light", "dark", "mixed"] },
        density: { type: "string", enum: ["compact", "balanced", "comfortable"] },
        radius: { type: "string", enum: ["sharp", "soft", "rounded"] },
        palette: { type: "array", items: { type: "string" }, maxItems: 8 },
        notes: { type: "array", items: { type: "string" }, maxItems: 8 },
      }, required: ["theme", "density", "radius", "palette", "notes"],
    },
    screen: {
      type: "object", additionalProperties: false,
      properties: {
        name: { type: "string" }, background: { type: "string" },
        sections: {
          type: "array", maxItems: 24,
          items: {
            type: "object", additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["navigation", "header", "hero", "content", "card", "list", "form", "footer", "sidebar", "media"] },
              name: { type: "string" }, text: { type: "string" }, bounds: boundsSchema,
              layout: { type: "string", enum: ["absolute", "horizontal", "vertical"] },
              controls: {
                type: "array", maxItems: 24,
                items: {
                  type: "object", additionalProperties: false,
                  properties: {
                    kind: { type: "string", enum: ["text", "button", "input", "card", "divider"] },
                    name: { type: "string" }, text: { type: "string" }, bounds: boundsSchema,
                    emphasis: { type: "string", enum: ["low", "medium", "high"] },
                  }, required: ["kind", "name", "text", "bounds", "emphasis"],
                },
              },
            }, required: ["kind", "name", "text", "bounds", "layout", "controls"],
          },
        },
      }, required: ["name", "background", "sections"],
    },
  }, required: ["summary", "visualDirection", "screen"],
} as const;

let counter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const validHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;

function pixelBounds(bounds: NormalizedBounds, width: number, height: number) {
  return { x: Math.round(clamp01(bounds.x) * width), y: Math.round(clamp01(bounds.y) * height), width: Math.max(8, Math.round(clamp01(bounds.width) * width)), height: Math.max(8, Math.round(clamp01(bounds.height) * height)) };
}

export function visionPlanToPage(plan: SemanticReferencePlan, reference: DesignReference, tokens: DesignTokens, canvasX = 0, canvasY = 0): DesignPage {
  const ratio = reference.analysis.aspectRatio || 1.6;
  const width = ratio < .8 ? 390 : ratio < 1.2 ? 600 : 720;
  const height = Math.max(460, Math.min(1000, Math.round(width / ratio)));
  const nodes: DesignNode[] = [];
  const background = validHex(plan.screen.background) || tokens.colors.background;

  for (const section of plan.screen.sections) {
    const rect = pixelBounds(section.bounds, width, height);
    const sectionId = uid("frame");
    const sectionNode: DesignNode = {
      id: sectionId, type: "frame", name: section.name || section.kind, ...rect,
      style: { background: section.kind === "navigation" || section.kind === "sidebar" ? tokens.colors.surface : "transparent", borderColor: section.kind === "card" ? tokens.colors.border : "transparent", borderWidth: 1, radius: tokens.radius.md, padding: 0 },
      children: [], layout: { mode: section.layout, gap: 10, widthMode: "fixed", heightMode: "fixed" },
      constraints: { horizontal: section.kind === "sidebar" ? "left" : "left-right", vertical: section.kind === "footer" ? "bottom" : "top" },
    };
    nodes.push(sectionNode);
    for (const control of section.controls) {
      const local = pixelBounds(control.bounds, rect.width, rect.height);
      const id = uid(control.kind);
      const isPrimary = control.emphasis === "high";
      const node: DesignNode = {
        id, type: control.kind, name: control.name, text: control.text,
        x: local.x, y: local.y, width: local.width, height: local.height, parentId: sectionId,
        style: {
          color: tokens.colors.text,
          background: control.kind === "button" ? (isPrimary ? tokens.colors.accent : tokens.colors.surfaceElevated) : control.kind === "input" || control.kind === "card" ? tokens.colors.surfaceElevated : undefined,
          borderColor: control.kind === "button" || control.kind === "input" || control.kind === "card" ? tokens.colors.border : undefined,
          borderWidth: control.kind === "button" || control.kind === "input" || control.kind === "card" ? 1 : undefined,
          radius: control.kind === "button" || control.kind === "input" || control.kind === "card" ? tokens.radius.md : undefined,
          padding: control.kind === "button" || control.kind === "input" || control.kind === "card" ? 10 : 0,
          fontSize: control.kind === "text" ? (isPrimary ? 24 : control.emphasis === "medium" ? 15 : 12) : 13,
          fontWeight: isPrimary ? 700 : control.emphasis === "medium" ? 600 : 450,
        },
        layout: { mode: "absolute", widthMode: "fixed", heightMode: "fixed" }, constraints: { horizontal: "left", vertical: "top" },
      };
      sectionNode.children!.push(id);
      nodes.push(node);
    }
    if (!section.controls.length && section.text) {
      const id = uid("text");
      sectionNode.children!.push(id);
      nodes.push({ id, type: "text", name: `${section.name} text`, text: section.text, x: 12, y: 12, width: Math.max(20, rect.width - 24), height: Math.max(24, rect.height - 24), parentId: sectionId, style: { color: tokens.colors.text, fontSize: 13, fontWeight: 500 }, layout: { mode: "absolute", widthMode: "fill", heightMode: "hug" }, constraints: { horizontal: "left-right", vertical: "top" } });
    }
  }

  return { id: uid("page"), name: plan.screen.name || `${reference.name} AI`, route: `/vision-${reference.id.slice(-8)}`, x: canvasX, y: canvasY, width, height, background, nodes };
}

export function validateSemanticReferencePlan(value: unknown): value is SemanticReferencePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<SemanticReferencePlan>;
  return typeof plan.summary === "string" && !!plan.visualDirection && !!plan.screen && typeof plan.screen.name === "string" && Array.isArray(plan.screen.sections);
}
