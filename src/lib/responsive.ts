import type { DesignNode, DesignPage } from "./types";

export interface ViewportPreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

export const viewportPresets: ViewportPreset[] = [
  { id: "mobile", name: "Mobile", width: 390, height: 844 },
  { id: "tablet", name: "Tablet", width: 768, height: 1024 },
  { id: "desktop", name: "Desktop", width: 1440, height: 900 },
];

const clamp = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
};

function horizontalGeometry(node: DesignNode, parentWidth: number, nextParentWidth: number) {
  const mode = node.constraints?.horizontal || "left";
  const delta = nextParentWidth - parentWidth;
  const ratio = parentWidth ? nextParentWidth / parentWidth : 1;
  let x = node.x;
  let width = node.width;
  if (mode === "right") x += delta;
  else if (mode === "left-right") width += delta;
  else if (mode === "center") x += delta / 2;
  else if (mode === "scale") { x *= ratio; width *= ratio; }
  width = clamp(width, node.constraints?.minWidth, node.constraints?.maxWidth);
  return { x: Math.round(x), width: Math.round(Math.max(0, width)) };
}

function verticalGeometry(node: DesignNode, parentHeight: number, nextParentHeight: number) {
  const mode = node.constraints?.vertical || "top";
  const delta = nextParentHeight - parentHeight;
  const ratio = parentHeight ? nextParentHeight / parentHeight : 1;
  let y = node.y;
  let height = node.height;
  if (mode === "bottom") y += delta;
  else if (mode === "top-bottom") height += delta;
  else if (mode === "center") y += delta / 2;
  else if (mode === "scale") { y *= ratio; height *= ratio; }
  height = clamp(height, node.constraints?.minHeight, node.constraints?.maxHeight);
  return { y: Math.round(y), height: Math.round(Math.max(0, height)) };
}

function adaptTree(nodes: DesignNode[], parentId: string | undefined, parentWidth: number, parentHeight: number, nextParentWidth: number, nextParentHeight: number, viewportWidth: number): DesignNode[] {
  const siblings = nodes.filter((node) => node.parentId === parentId);
  const updates = new Map<string, DesignNode>();
  for (const node of siblings) {
    const hidden = (typeof node.constraints?.hiddenBelow === "number" && viewportWidth < node.constraints.hiddenBelow)
      || (typeof node.constraints?.hiddenAbove === "number" && viewportWidth > node.constraints.hiddenAbove);
    const horizontal = horizontalGeometry(node, parentWidth, nextParentWidth);
    const vertical = verticalGeometry(node, parentHeight, nextParentHeight);
    const nextNode: DesignNode = {
      ...structuredClone(node),
      ...horizontal,
      ...vertical,
      style: { ...structuredClone(node.style), opacity: hidden ? 0 : node.style.opacity },
    };
    updates.set(node.id, nextNode);

    const descendants = adaptTree(nodes, node.id, node.width, node.height, nextNode.width, nextNode.height, viewportWidth);
    for (const descendant of descendants) updates.set(descendant.id, descendant);
  }
  return [...updates.values()];
}

/**
 * Recomputes page geometry for a target viewport while preserving semantic ids,
 * components, layout metadata and prototype actions. Hidden breakpoint nodes are
 * retained with opacity 0 so mappings remain stable for design/code round-trip.
 */
export function adaptPageToViewport(page: DesignPage, width: number, height = page.height): DesignPage {
  const next = structuredClone(page);
  const adapted = adaptTree(page.nodes, undefined, page.width, page.height, width, height, width);
  const byId = new Map(adapted.map((node) => [node.id, node]));
  next.width = width;
  next.height = height;
  next.nodes = page.nodes.map((node) => byId.get(node.id) || structuredClone(node));
  return next;
}
