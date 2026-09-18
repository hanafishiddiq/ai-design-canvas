import { mergeTokens, parseDesignMd } from "./design-md";
import { generateTokens } from "./foundations";
import type {
  ComponentDefinition, DesignNode, DesignPage, DesignProject, DesignVariable,
  VariableCollection, VariableType,
} from "./types";

type Json = Record<string, unknown>;

export interface OpenPencilLoss {
  kind: "unsupported-node" | "style" | "interaction" | "variable" | "flow" | "component";
  severity: "info" | "warning";
  sourceId?: string;
  message: string;
}
export interface OpenPencilPullReport {
  pages: number;
  nodes: number;
  components: number;
  variables: number;
  designMd: boolean;
  losses: OpenPencilLoss[];
  warnings: string[];
}
export interface OpenPencilPullResult {
  project: DesignProject;
  report: OpenPencilPullReport;
}

const record = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const textValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const numberValue = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "screen";

function sizing(value: unknown, fallback: number, losses: OpenPencilLoss[], sourceId: string) {
  if (typeof value === "number" && Number.isFinite(value)) return { pixels: Math.max(1, value), mode: "fixed" as const };
  if (value === "fill_container") return { pixels: Math.max(1, fallback), mode: "fill" as const };
  if (value === "fit_content") return { pixels: Math.max(1, fallback), mode: "hug" as const };
  if (typeof value === "string" && value.startsWith("$")) {
    losses.push({ kind: "variable", severity: "info", sourceId, message: `Sizing variable ${value} was preserved as fixed geometry because AI Design Canvas does not yet bind sizing directly to a variable.` });
  }
  return { pixels: Math.max(1, fallback), mode: "fixed" as const };
}

function firstSolid(fill: unknown, losses: OpenPencilLoss[], sourceId: string): string | undefined {
  const fills = array(fill).map(record);
  const solid = fills.find((item) => item.type === "solid" && typeof item.color === "string");
  if (fills.length && !solid) losses.push({ kind: "style", severity: "warning", sourceId, message: "Non-solid fill could not be represented exactly; its structured definition remains in OpenPencil." });
  return solid ? String(solid.color) : undefined;
}

function strokeInfo(value: unknown, losses: OpenPencilLoss[], sourceId: string) {
  const stroke = record(value);
  if (!Object.keys(stroke).length) return {};
  const color = firstSolid(stroke.fill, losses, sourceId);
  const thickness = typeof stroke.thickness === "number" ? stroke.thickness : 1;
  return { borderColor: color, borderWidth: thickness };
}

function radius(value: unknown, losses: OpenPencilLoss[], sourceId: string) {
  if (typeof value === "number") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    const values = value as number[];
    const first = values[0] || 0;
    if (values.some((item) => item !== first)) losses.push({ kind: "style", severity: "info", sourceId, message: "Per-corner radius was collapsed to one radius value." });
    return first;
  }
  return undefined;
}
function constraintH(value: unknown): NonNullable<DesignNode["constraints"]>["horizontal"] {
  return value === "left_right" ? "left-right" : value === "right" || value === "center" || value === "scale" ? value : "left";
}
function constraintV(value: unknown): NonNullable<DesignNode["constraints"]>["vertical"] {
  return value === "top_bottom" ? "top-bottom" : value === "bottom" || value === "center" || value === "scale" ? value : "top";
}
function paddingValues(value: unknown) {
  if (typeof value === "number") return [value, value, value, value] as const;
  if (Array.isArray(value)) {
    const nums = value.map((item) => typeof item === "number" ? item : 0);
    if (nums.length === 2) return [nums[0], nums[1], nums[0], nums[1]] as const;
    if (nums.length >= 4) return [nums[0], nums[1], nums[2], nums[3]] as const;
  }
  return [0, 0, 0, 0] as const;
}
function plainText(content: unknown, losses: OpenPencilLoss[], sourceId: string) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    losses.push({ kind: "style", severity: "info", sourceId, message: "Styled text runs were flattened to plain text; font-run fidelity remains in OpenPencil." });
    return content.map((segment) => textValue(record(segment).text, textValue(record(segment).content))).join("");
  }
  return "";
}

function mappedType(type: string, role: string, losses: OpenPencilLoss[], sourceId: string): DesignNode["type"] {
  if (role.toLowerCase().includes("button")) return "button";
  if (type === "text") return "text";
  if (["text_input", "text_area", "select", "checkbox", "switch", "slider", "radio_group", "number_input"].includes(type)) {
    if (!["text_input", "text_area", "number_input"].includes(type)) losses.push({ kind: "interaction", severity: "warning", sourceId, message: `${type} was imported as a generic input because the current project schema has fewer widget primitives.` });
    return "input";
  }
  if (type === "line") return "divider";
  if (type === "rectangle") return "card";
  if (["ellipse", "polygon", "path", "image", "icon_font"].includes(type)) {
    losses.push({ kind: "unsupported-node", severity: "warning", sourceId, message: `${type} was imported as a frame/card placeholder; vector/media-specific data remains loss-reported.` });
    return "card";
  }
  if (type === "ref") {
    losses.push({ kind: "component", severity: "info", sourceId, message: "OpenPencil ref node was imported as a frame; component reference reconciliation is preserved separately when reusable masters are available." });
  }
  return "frame";
}

function flattenPenNode(
  raw: unknown,
  out: DesignNode[],
  losses: OpenPencilLoss[],
  parentId?: string,
): string | null {
  const node = record(raw);
  const type = textValue(node.type, "frame");
  const id = textValue(node.id);
  if (!id) {
    losses.push({ kind: "unsupported-node", severity: "warning", message: `Skipped OpenPencil ${type} node without a stable id.` });
    return null;
  }
  const name = textValue(node.name, type);
  const role = textValue(node.role);
  const width = sizing(node.width, type === "text" ? 180 : 120, losses, id);
  const height = sizing(node.height, type === "text" ? 24 : 48, losses, id);
  const constraints = record(node.constraints);
  const layoutMode = node.layout === "horizontal" || node.layout === "vertical" ? node.layout : "absolute";
  const padding = paddingValues(node.padding);
  const designType = mappedType(type, role, losses, id);
  const fill = firstSolid(node.fill, losses, id);
  const stroke = strokeInfo(node.stroke, losses, id);
  const text = type === "text" ? plainText(node.content, losses, id) : textValue(node.label, textValue(node.content));

  if (array(node.effects).length) losses.push({ kind: "style", severity: "info", sourceId: id, message: "Effects/shadows are not represented in the current AI Design Canvas node style and were loss-reported." });
  if (numberValue(node.rotation) !== 0) losses.push({ kind: "style", severity: "warning", sourceId: id, message: "Rotation is not represented in the current project schema." });
  if (node.maskType) losses.push({ kind: "style", severity: "warning", sourceId: id, message: "Mask semantics are not represented in the current project schema." });
  if (node.events || node.route) losses.push({ kind: "interaction", severity: "info", sourceId: id, message: "OpenPencil event/route semantics require manual reconciliation with AI Design Canvas prototype flows." });

  const childrenRaw = Array.isArray(node.children) ? node.children : [];
  const childIds = childrenRaw.map((child) => textValue(record(child).id)).filter(Boolean);
  const result: DesignNode = {
    id,
    type: designType,
    name,
    ...(text ? { text } : {}),
    x: numberValue(node.x),
    y: numberValue(node.y),
    width: width.pixels,
    height: height.pixels,
    style: {
      ...(fill ? { background: designType === "text" ? undefined : fill, color: designType === "text" ? fill : undefined } : {}),
      ...stroke,
      ...(radius(node.cornerRadius, losses, id) !== undefined ? { radius: radius(node.cornerRadius, losses, id) } : {}),
      ...(typeof node.fontSize === "number" ? { fontSize: node.fontSize } : {}),
      ...(typeof node.fontWeight === "number" ? { fontWeight: node.fontWeight } : {}),
      ...(typeof node.opacity === "number" ? { opacity: node.opacity } : {}),
      ...(node.textAlign === "center" || node.textAlign === "right" || node.textAlign === "left" ? { align: node.textAlign } : {}),
    },
    ...(parentId ? { parentId } : {}),
    ...(childIds.length ? { children: childIds } : {}),
    layout: {
      mode: layoutMode,
      gap: numberValue(node.gap),
      paddingTop: padding[0], paddingRight: padding[1], paddingBottom: padding[2], paddingLeft: padding[3],
      align: node.alignItems === "center" || node.alignItems === "end" || node.alignItems === "stretch" ? node.alignItems : "start",
      justify: node.justifyContent === "center" || node.justifyContent === "end" ? node.justifyContent : node.justifyContent === "space_between" ? "space-between" : "start",
      widthMode: width.mode,
      heightMode: height.mode,
    },
    constraints: {
      horizontal: constraintH(constraints.h),
      vertical: constraintV(constraints.v),
      ...(typeof node.minWidth === "number" ? { minWidth: node.minWidth } : {}),
      ...(typeof node.maxWidth === "number" ? { maxWidth: node.maxWidth } : {}),
      ...(typeof node.minHeight === "number" ? { minHeight: node.minHeight } : {}),
      ...(typeof node.maxHeight === "number" ? { maxHeight: node.maxHeight } : {}),
    },
  };
  out.push(result);
  for (const child of childrenRaw) flattenPenNode(child, out, losses, id);
  return id;
}

function pageBackground(root: Json, fallback: string, losses: OpenPencilLoss[]) {
  return firstSolid(root.fill, losses, textValue(root.id, "screen")) || fallback;
}

export function penRootsToPages(
  physicalPage: { id: string; name: string },
  roots: unknown[],
  fallbackBackground: string,
  losses: OpenPencilLoss[],
): DesignPage[] {
  const screenRoots = roots.map(record).filter((root) => root.type === "frame" && typeof root.screen === "string" && root.screen);
  if (screenRoots.length) return screenRoots.map((root, index) => {
    const nodes: DesignNode[] = [];
    for (const child of array(root.children)) flattenPenNode(child, nodes, losses);
    return {
      id: textValue(root.id, `op_screen_${physicalPage.id}_${index}`),
      name: textValue(root.name, physicalPage.name),
      route: textValue(root.screen, `/${slug(textValue(root.name, physicalPage.name))}`),
      x: numberValue(root.x, index * 820),
      y: numberValue(root.y),
      width: sizing(root.width, 720, losses, textValue(root.id, physicalPage.id)).pixels,
      height: sizing(root.height, 460, losses, textValue(root.id, physicalPage.id)).pixels,
      background: pageBackground(root, fallbackBackground, losses),
      nodes,
    };
  });

  const nodes: DesignNode[] = [];
  for (const root of roots) flattenPenNode(root, nodes, losses);
  const maxX = Math.max(720, ...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(460, ...nodes.map((node) => node.y + node.height));
  return [{
    id: `op_page_${physicalPage.id}`,
    name: physicalPage.name || "OpenPencil Page",
    route: `/${slug(physicalPage.name || physicalPage.id)}`,
    x: 0, y: 0, width: maxX, height: maxY, background: fallbackBackground, nodes,
  }];
}

function scalarType(value: unknown, declared?: unknown): VariableType {
  const type = textValue(declared).toLowerCase();
  if (type.includes("color")) return "color";
  if (type.includes("number")) return "number";
  if (type.includes("boolean")) return "boolean";
  if (type.includes("string")) return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value)) return "color";
  return "string";
}
function primitive(value: unknown): string | number | boolean | undefined {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined;
}
export function openPencilVariablesToCollections(rawVariables: unknown, rawThemes: unknown, losses: OpenPencilLoss[]): VariableCollection[] {
  const variables = record(rawVariables);
  const themes = record(rawThemes);
  const groups = new Map<string, DesignVariable[]>();
  for (const [key, rawDefinition] of Object.entries(variables)) {
    const definition = record(rawDefinition);
    const [prefix, ...rest] = key.split("/");
    const name = rest.join("/") || prefix;
    const value = primitive(definition.value) ?? primitive(rawDefinition);
    if (value === undefined) {
      losses.push({ kind: "variable", severity: "warning", sourceId: key, message: "Complex OpenPencil variable value could not be imported into scalar AI Design Canvas variables." });
      continue;
    }
    const values: Record<string, string | number | boolean> = { default: value };
    const themed = record(definition.values);
    for (const [mode, candidate] of Object.entries(themed)) {
      const scalar = primitive(candidate);
      if (scalar !== undefined) values[mode] = scalar;
    }
    const variable: DesignVariable = { id: `opvar:${key}`, name, type: scalarType(value, definition.type || definition.kind), values };
    const list = groups.get(prefix) || []; list.push(variable); groups.set(prefix, list);
  }
  return [...groups.entries()].map(([prefix, variablesInGroup]) => {
    const themeModes = Object.values(themes).flatMap((value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
    const valueModes = variablesInGroup.flatMap((variable) => Object.keys(variable.values).filter((mode) => mode !== "default"));
    const modes = [...new Set([...themeModes, ...valueModes])];
    return { id: prefix.startsWith("system.") ? prefix : `openpencil.${prefix}`, name: `OpenPencil · ${prefix}`, modes: modes.length ? modes : ["default"], defaultMode: modes[0] || "default", variables: variablesInGroup };
  });
}

export function mergeOpenPencilPull(
  base: DesignProject,
  pages: DesignPage[],
  components: ComponentDefinition[],
  collections: VariableCollection[],
  designMd: string | undefined,
  losses: OpenPencilLoss[],
  warnings: string[],
): OpenPencilPullResult {
  const next = structuredClone(base);
  if (pages.length) next.pages = pages;
  next.activePageId = pages.find((page) => page.route === base.pages.find((candidate) => candidate.id === base.activePageId)?.route)?.id || pages[0]?.id || base.activePageId;
  if (components.length) {
    for (const component of components) next.components[component.id] = component;
  }
  if (collections.length) {
    for (const collection of collections) {
      const index = next.variables.findIndex((candidate) => candidate.id === collection.id);
      if (index >= 0) next.variables[index] = collection; else next.variables.push(collection);
    }
  }
  if (designMd) {
    next.designMd = designMd;
    const parsed = parseDesignMd(designMd);
    const direction = { ...next.direction, ...(parsed.direction || {}) };
    next.direction = direction;
    next.tokens = mergeTokens(generateTokens(direction), parsed.tokens);
  }

  const validPageIds = new Set(next.pages.map((page) => page.id));
  const validNodeIds = new Set(next.pages.flatMap((page) => page.nodes.map((node) => node.id)));
  const originalFlowCount = next.flows.length;
  next.flows = next.flows.filter((flow) => validPageIds.has(flow.fromPageId) && validPageIds.has(flow.toPageId) && validNodeIds.has(flow.fromNodeId));
  if (next.flows.length !== originalFlowCount) losses.push({ kind: "flow", severity: "warning", message: `${originalFlowCount - next.flows.length} prototype flow(s) could not be retained after OpenPencil page reconciliation.` });
  next.updatedAt = new Date().toISOString();
  return {
    project: next,
    report: {
      pages: pages.length,
      nodes: pages.reduce((sum, page) => sum + page.nodes.length, 0),
      components: components.length,
      variables: collections.reduce((sum, collection) => sum + collection.variables.length, 0),
      designMd: !!designMd,
      losses,
      warnings,
    },
  };
}

export function reusablePenNodeToComponent(raw: unknown, losses: OpenPencilLoss[]): ComponentDefinition | null {
  const root = record(raw);
  const id = textValue(root.id);
  if (!id) return null;
  const nodes: DesignNode[] = [];
  for (const child of array(root.children)) flattenPenNode(child, nodes, losses);
  const timestamp = new Date().toISOString();
  return {
    id,
    name: textValue(root.name, "OpenPencil Component"),
    width: sizing(root.width, 120, losses, id).pixels,
    height: sizing(root.height, 48, losses, id).pixels,
    nodes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
