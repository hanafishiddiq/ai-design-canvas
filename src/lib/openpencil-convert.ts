import type { ComponentDefinition, DesignNode, DesignPage, DesignProject, VariableCollection } from "./types";

export type PenNodeJson = Record<string, unknown>;

const solidFill = (color?: string) => color ? [{ type: "solid", color, opacity: 1, explain: null, blendMode: null }] : null;
const sizing = (mode: "fixed" | "hug" | "fill" | undefined, pixels: number) => mode === "hug" ? "fit_content" : mode === "fill" ? "fill_container" : pixels;
const hConstraint = (value?: string) => value === "left-right" ? "left_right" : value || "left";
const vConstraint = (value?: string) => value === "top-bottom" ? "top_bottom" : value || "top";
const justify = (value?: string) => value === "space-between" ? "space_between" : value || "start";

function padding(node: DesignNode) {
  const layout = node.layout;
  if (!layout) return node.style.padding ?? 0;
  const top = layout.paddingTop ?? node.style.padding ?? 0;
  const right = layout.paddingRight ?? node.style.padding ?? 0;
  const bottom = layout.paddingBottom ?? node.style.padding ?? 0;
  const left = layout.paddingLeft ?? node.style.padding ?? 0;
  if (top === right && right === bottom && bottom === left) return top;
  return [top, right, bottom, left];
}

function common(node: DesignNode) {
  return {
    id: node.id,
    name: node.name,
    x: node.x,
    y: node.y,
    opacity: node.style.opacity ?? 1,
    visible: (node.style.opacity ?? 1) > 0,
    constraints: { h: hConstraint(node.constraints?.horizontal), v: vConstraint(node.constraints?.vertical) },
    minWidth: node.constraints?.minWidth ?? null,
    maxWidth: node.constraints?.maxWidth ?? null,
    minHeight: node.constraints?.minHeight ?? null,
    maxHeight: node.constraints?.maxHeight ?? null,
  };
}

function childNodes(node: DesignNode, allNodes: DesignNode[]) {
  return (node.children || [])
    .map((id) => allNodes.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is DesignNode => !!candidate)
    .map((candidate) => designNodeToPenNode(candidate, allNodes));
}

export function designNodeToPenNode(node: DesignNode, allNodes: DesignNode[]): PenNodeJson {
  const base = common(node);
  if (node.type === "text") {
    return {
      type: "text",
      ...base,
      width: sizing(node.layout?.widthMode, node.width),
      height: sizing(node.layout?.heightMode, node.height),
      content: node.text || "",
      fontSize: node.style.fontSize ?? 14,
      fontWeight: node.style.fontWeight ?? 400,
      textAlign: node.style.align || "left",
      textGrowth: node.layout?.widthMode === "hug" ? "auto" : "fixed-width-height",
      fill: solidFill(node.style.color),
    };
  }

  const nested = childNodes(node, allNodes);
  const frame: PenNodeJson = {
    type: "frame",
    ...base,
    width: sizing(node.layout?.widthMode, node.width),
    height: sizing(node.layout?.heightMode, node.height),
    layout: node.layout?.mode === "absolute" || !node.layout?.mode ? "none" : node.layout.mode,
    gap: node.layout?.gap ?? node.style.gap ?? 0,
    padding: padding(node),
    justifyContent: justify(node.layout?.justify),
    alignItems: node.layout?.align || "start",
    clipContent: false,
    cornerRadius: node.style.radius ?? 0,
    fill: solidFill(node.style.background),
    children: nested,
  };

  // Preserve visible labels for primitive controls without inventing widget
  // semantics that the source project does not actually model yet.
  if (node.text && nested.length === 0 && node.type !== "card") {
    frame.children = [{
      type: "text",
      id: `${node.id}__label`,
      name: `${node.name} label`,
      x: node.style.padding ?? 0,
      y: node.style.padding ?? 0,
      width: Math.max(1, node.width - (node.style.padding ?? 0) * 2),
      height: Math.max(1, node.height - (node.style.padding ?? 0) * 2),
      content: node.text,
      fontSize: node.style.fontSize ?? 13,
      fontWeight: node.style.fontWeight ?? 500,
      textAlign: node.style.align || "left",
      textGrowth: "fixed-width-height",
      fill: solidFill(node.style.color),
    }];
  }
  return frame;
}

export function pageToPenFrame(page: DesignPage): PenNodeJson {
  const roots = page.nodes.filter((node) => !node.parentId);
  return {
    type: "frame",
    id: page.id,
    name: page.name,
    screen: page.route,
    x: page.x,
    y: page.y,
    width: page.width,
    height: page.height,
    layout: "none",
    fill: solidFill(page.background),
    children: roots.map((node) => designNodeToPenNode(node, page.nodes)),
  };
}

export function componentToPenFrame(component: ComponentDefinition): PenNodeJson {
  const roots = component.nodes.filter((node) => !node.parentId);
  return {
    type: "frame",
    id: component.id,
    name: component.name,
    width: component.width,
    height: component.height,
    reusable: true,
    layout: "none",
    children: roots.map((node) => designNodeToPenNode(node, component.nodes)),
  };
}

export function variablesToOpenPencil(collections: VariableCollection[]) {
  const out: Record<string, { type: string; value: string | number | boolean; modes?: Record<string, string | number | boolean> }> = {};
  for (const collection of collections) {
    for (const variable of collection.variables) {
      const active = variable.values[collection.defaultMode];
      if (active === undefined) continue;
      const key = `${collection.id.replace(/^system\./, "")}/${variable.name}`;
      out[key] = { type: variable.type, value: active, modes: { ...variable.values } };
    }
  }
  return out;
}

export function projectToOpenPencilConversion(project: DesignProject) {
  return {
    designMd: project.designMd,
    variables: variablesToOpenPencil(project.variables),
    components: Object.values(project.components).map((component) => ({
      key: `ai-design-canvas:component:${component.id}`,
      name: component.name,
      node_json: componentToPenFrame(component),
      sourcePath: "ai-design-canvas/components",
      sourceHash: `${project.version}:${component.updatedAt}`,
    })),
    screens: project.pages.map((page) => ({
      key: `route:${page.route}`,
      node_json: pageToPenFrame(page),
      sourcePath: `ai-design-canvas/screens/${page.id}`,
      sourceHash: `${project.version}:${project.updatedAt}:${page.id}`,
    })),
  };
}
