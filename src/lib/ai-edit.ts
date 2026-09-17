import type { DesignNode, LayoutAlign, LayoutMode, NodeStyle, NodeType, ResponsiveConstraints, SizingMode } from "./types";
import type { DesignPage } from "./types";
import type { DesignOperation } from "./operations";

export type AiEditActionType = "update_text" | "update_geometry" | "update_style" | "update_layout" | "update_constraints" | "insert_node" | "remove_node";

export interface AiEditAction {
  action: AiEditActionType;
  nodeId: string | null;
  kind: NodeType | null;
  name: string | null;
  text: string | null;
  parentId: string | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  background: string | null;
  color: string | null;
  borderColor: string | null;
  radius: number | null;
  padding: number | null;
  fontSize: number | null;
  fontWeight: number | null;
  gap: number | null;
  layoutMode: LayoutMode | null;
  align: LayoutAlign | null;
  widthMode: SizingMode | null;
  heightMode: SizingMode | null;
  horizontalConstraint: NonNullable<ResponsiveConstraints["horizontal"]> | null;
  verticalConstraint: NonNullable<ResponsiveConstraints["vertical"]> | null;
}

export interface AiEditProposal {
  summary: string;
  rationale: string;
  warnings: string[];
  actions: AiEditAction[];
}

const nullableNumber = { type: ["number", "null"] };
const nullableString = { type: ["string", "null"] };
export const AI_EDIT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    summary: { type: "string" }, rationale: { type: "string" },
    warnings: { type: "array", items: { type: "string" }, maxItems: 8 },
    actions: {
      type: "array", maxItems: 40,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["update_text", "update_geometry", "update_style", "update_layout", "update_constraints", "insert_node", "remove_node"] },
          nodeId: nullableString,
          kind: { type: ["string", "null"], enum: ["frame", "text", "button", "card", "metric", "list", "input", "divider", null] },
          name: nullableString, text: nullableString, parentId: nullableString,
          x: nullableNumber, y: nullableNumber, width: nullableNumber, height: nullableNumber,
          background: nullableString, color: nullableString, borderColor: nullableString,
          radius: nullableNumber, padding: nullableNumber, fontSize: nullableNumber, fontWeight: nullableNumber, gap: nullableNumber,
          layoutMode: { type: ["string", "null"], enum: ["absolute", "horizontal", "vertical", null] },
          align: { type: ["string", "null"], enum: ["start", "center", "end", "stretch", null] },
          widthMode: { type: ["string", "null"], enum: ["fixed", "hug", "fill", null] },
          heightMode: { type: ["string", "null"], enum: ["fixed", "hug", "fill", null] },
          horizontalConstraint: { type: ["string", "null"], enum: ["left", "right", "left-right", "center", "scale", null] },
          verticalConstraint: { type: ["string", "null"], enum: ["top", "bottom", "top-bottom", "center", "scale", null] },
        },
        required: ["action", "nodeId", "kind", "name", "text", "parentId", "x", "y", "width", "height", "background", "color", "borderColor", "radius", "padding", "fontSize", "fontWeight", "gap", "layoutMode", "align", "widthMode", "heightMode", "horizontalConstraint", "verticalConstraint"],
      },
    },
  }, required: ["summary", "rationale", "warnings", "actions"],
} as const;

const finite = (value: number | null, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const validHex = (value: string | null) => value && (/^#[0-9a-f]{3,8}$/i.test(value) || value === "transparent") ? value : undefined;
let counter = 0;
const uid = () => `ai_node_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function validateAiEditProposal(value: unknown): value is AiEditProposal {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AiEditProposal>;
  return typeof candidate.summary === "string" && typeof candidate.rationale === "string" && Array.isArray(candidate.warnings) && Array.isArray(candidate.actions);
}

export function proposalToOperations(proposal: AiEditProposal, page: DesignPage, selectedNodeIds: string[]): DesignOperation[] {
  const allIds = new Set(page.nodes.map((node) => node.id));
  const scope = new Set(selectedNodeIds.length ? selectedNodeIds : page.nodes.map((node) => node.id));
  const operations: DesignOperation[] = [];
  const existing = (action: AiEditAction) => {
    if (!action.nodeId || !allIds.has(action.nodeId) || !scope.has(action.nodeId)) return null;
    return page.nodes.find((node) => node.id === action.nodeId) || null;
  };

  for (const action of proposal.actions) {
    if (action.action === "insert_node") {
      const type = action.kind || "text";
      const parentId = action.parentId && allIds.has(action.parentId) ? action.parentId : undefined;
      const style: NodeStyle = { background: validHex(action.background), color: validHex(action.color), borderColor: validHex(action.borderColor), radius: action.radius ?? undefined, padding: action.padding ?? undefined, fontSize: action.fontSize ?? undefined, fontWeight: action.fontWeight ?? undefined };
      const node: DesignNode = {
        id: uid(), type, name: action.name || `AI ${type}`, text: action.text || undefined, parentId,
        x: finite(action.x, 24), y: finite(action.y, 24), width: Math.max(8, finite(action.width, type === "text" ? 180 : 140)), height: Math.max(8, finite(action.height, type === "text" ? 28 : 48)),
        style,
        layout: { mode: action.layoutMode || "absolute", gap: action.gap ?? undefined, align: action.align ?? undefined, widthMode: action.widthMode ?? "fixed", heightMode: action.heightMode ?? "fixed" },
        constraints: { horizontal: action.horizontalConstraint ?? "left", vertical: action.verticalConstraint ?? "top" },
      };
      operations.push({ type: "node.insert", pageId: page.id, node });
      continue;
    }

    const node = existing(action);
    if (!node) continue;
    if (action.action === "remove_node") { operations.push({ type: "node.remove", pageId: page.id, nodeId: node.id }); continue; }
    if (action.action === "update_text") { if (action.text !== null) operations.push({ type: "node.update", pageId: page.id, nodeId: node.id, changes: { text: action.text } }); continue; }
    if (action.action === "update_geometry") { operations.push({ type: "node.update", pageId: page.id, nodeId: node.id, changes: { x: finite(action.x, node.x), y: finite(action.y, node.y), width: Math.max(8, finite(action.width, node.width)), height: Math.max(8, finite(action.height, node.height)) } }); continue; }
    if (action.action === "update_style") {
      const style: NodeStyle = { ...node.style };
      const background = validHex(action.background); const color = validHex(action.color); const borderColor = validHex(action.borderColor);
      if (background) style.background = background; if (color) style.color = color; if (borderColor) style.borderColor = borderColor;
      if (action.radius !== null) style.radius = Math.max(0, action.radius); if (action.padding !== null) style.padding = Math.max(0, action.padding);
      if (action.fontSize !== null) style.fontSize = Math.max(6, action.fontSize); if (action.fontWeight !== null) style.fontWeight = Math.max(100, Math.min(900, action.fontWeight));
      operations.push({ type: "node.update", pageId: page.id, nodeId: node.id, changes: { style } }); continue;
    }
    if (action.action === "update_layout") { operations.push({ type: "node.update", pageId: page.id, nodeId: node.id, changes: { layout: { mode: action.layoutMode || node.layout?.mode || "absolute", gap: action.gap ?? node.layout?.gap, align: action.align ?? node.layout?.align, widthMode: action.widthMode ?? node.layout?.widthMode, heightMode: action.heightMode ?? node.layout?.heightMode } } }); continue; }
    if (action.action === "update_constraints") { operations.push({ type: "node.update", pageId: page.id, nodeId: node.id, changes: { constraints: { ...node.constraints, horizontal: action.horizontalConstraint ?? node.constraints?.horizontal, vertical: action.verticalConstraint ?? node.constraints?.vertical } } }); }
  }
  return operations;
}
