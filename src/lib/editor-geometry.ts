import type { DesignNode } from "./types";

export type AlignMode = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
export type DistributeMode = "horizontal" | "vertical";

export interface NodePositionPatch { nodeId: string; x?: number; y?: number }

export function sameParent(nodes: DesignNode[]) {
  if (!nodes.length) return true;
  const parent = nodes[0].parentId || "";
  return nodes.every((node) => (node.parentId || "") === parent);
}

export function alignNodes(nodes: DesignNode[], mode: AlignMode): NodePositionPatch[] {
  if (nodes.length < 2) return [];
  if (!sameParent(nodes)) throw new Error("Alignment requires nodes with the same parent.");
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return nodes.map((node) => {
    if (mode === "left") return { nodeId: node.id, x: minX };
    if (mode === "right") return { nodeId: node.id, x: maxX - node.width };
    if (mode === "center-x") return { nodeId: node.id, x: centerX - node.width / 2 };
    if (mode === "top") return { nodeId: node.id, y: minY };
    if (mode === "bottom") return { nodeId: node.id, y: maxY - node.height };
    return { nodeId: node.id, y: centerY - node.height / 2 };
  });
}

export function distributeNodes(nodes: DesignNode[], mode: DistributeMode): NodePositionPatch[] {
  if (nodes.length < 3) return [];
  if (!sameParent(nodes)) throw new Error("Distribution requires nodes with the same parent.");
  if (mode === "horizontal") {
    const sorted = [...nodes].sort((a, b) => a.x - b.x);
    const min = sorted[0].x;
    const max = Math.max(...sorted.map((node) => node.x + node.width));
    const total = sorted.reduce((sum, node) => sum + node.width, 0);
    const gap = (max - min - total) / (sorted.length - 1);
    let cursor = min;
    return sorted.map((node) => {
      const patch = { nodeId: node.id, x: cursor };
      cursor += node.width + gap;
      return patch;
    });
  }
  const sorted = [...nodes].sort((a, b) => a.y - b.y);
  const min = sorted[0].y;
  const max = Math.max(...sorted.map((node) => node.y + node.height));
  const total = sorted.reduce((sum, node) => sum + node.height, 0);
  const gap = (max - min - total) / (sorted.length - 1);
  let cursor = min;
  return sorted.map((node) => {
    const patch = { nodeId: node.id, y: cursor };
    cursor += node.height + gap;
    return patch;
  });
}

export interface DesignClipboardPayload {
  schema: "ai-design-canvas/clipboard/v1";
  nodes: DesignNode[];
}

export function selectionWithDescendants(allNodes: DesignNode[], ids: string[]) {
  const selected = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of allNodes) {
      if (!selected.has(node.id)) continue;
      for (const childId of node.children || []) {
        if (!selected.has(childId)) { selected.add(childId); changed = true; }
      }
    }
  }
  return allNodes.filter((node) => selected.has(node.id));
}

export function serializeNodeClipboard(allNodes: DesignNode[], ids: string[]) {
  const nodes = selectionWithDescendants(allNodes, ids);
  return JSON.stringify({ schema: "ai-design-canvas/clipboard/v1", nodes } satisfies DesignClipboardPayload);
}

export function parseNodeClipboard(source: string): DesignClipboardPayload {
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error("Clipboard does not contain AI Design Canvas JSON."); }
  if (!value || typeof value !== "object") throw new Error("Invalid design clipboard payload.");
  const candidate = value as Partial<DesignClipboardPayload>;
  if (candidate.schema !== "ai-design-canvas/clipboard/v1" || !Array.isArray(candidate.nodes)) throw new Error("Unsupported design clipboard payload.");
  return candidate as DesignClipboardPayload;
}

export function remapPastedNodes(nodes: DesignNode[], makeId: (prefix: string) => string, offset = 20) {
  const ids = new Set(nodes.map((node) => node.id));
  const map = new Map(nodes.map((node) => [node.id, makeId("node")]));
  const copied = nodes.map((node) => ({
    ...structuredClone(node),
    id: map.get(node.id)!,
    x: node.x + (node.parentId && ids.has(node.parentId) ? 0 : offset),
    y: node.y + (node.parentId && ids.has(node.parentId) ? 0 : offset),
    parentId: node.parentId && ids.has(node.parentId) ? map.get(node.parentId) : undefined,
    children: node.children?.map((id) => map.get(id)).filter((id): id is string => !!id),
    component: node.component ? { ...node.component, instanceId: makeId("instance") } : undefined,
  }));
  return { nodes: copied, rootIds: copied.filter((node) => !node.parentId).map((node) => node.id) };
}

export interface Rect { x: number; y: number; width: number; height: number }
export function intersects(a: Rect, b: Rect) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function absoluteNodeRect(node: DesignNode, allNodes: DesignNode[]): Rect {
  let x = node.x, y = node.y, parentId = node.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = allNodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    x += parent.x; y += parent.y; parentId = parent.parentId;
  }
  return { x, y, width: node.width, height: node.height };
}
