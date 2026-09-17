import type { AutoLayoutSpec, DesignNode } from "./types";

export interface LayoutResult {
  container: Pick<DesignNode, "width" | "height">;
  nodes: DesignNode[];
}

const sizeWithin = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
};

/**
 * Computes semantic auto-layout while preserving node identities. The renderer
 * can apply the returned geometry directly, and the layout metadata remains the
 * source of truth for later responsive recomputation.
 */
export function layoutChildren(container: DesignNode, children: DesignNode[], override?: Partial<AutoLayoutSpec>): LayoutResult {
  const layout: AutoLayoutSpec = { mode: "vertical", gap: 0, align: "start", justify: "start", ...container.layout, ...override };
  if (layout.mode === "absolute") return { container: { width: container.width, height: container.height }, nodes: structuredClone(children) };

  const horizontal = layout.mode === "horizontal";
  const gap = layout.gap ?? 0;
  const paddingTop = layout.paddingTop ?? container.style.padding ?? 0;
  const paddingRight = layout.paddingRight ?? container.style.padding ?? 0;
  const paddingBottom = layout.paddingBottom ?? container.style.padding ?? 0;
  const paddingLeft = layout.paddingLeft ?? container.style.padding ?? 0;
  const mainAvailable = horizontal
    ? container.width - paddingLeft - paddingRight
    : container.height - paddingTop - paddingBottom;
  const crossAvailable = horizontal
    ? container.height - paddingTop - paddingBottom
    : container.width - paddingLeft - paddingRight;

  const result = structuredClone(children);
  const fixedMain = result.reduce((sum, node) => {
    const mode = horizontal ? node.layout?.widthMode : node.layout?.heightMode;
    const size = horizontal ? node.width : node.height;
    return sum + (mode === "fill" ? 0 : size);
  }, 0);
  const fillCount = result.filter((node) => (horizontal ? node.layout?.widthMode : node.layout?.heightMode) === "fill").length;
  const availableForFill = Math.max(0, mainAvailable - fixedMain - Math.max(0, result.length - 1) * gap);
  const fillSize = fillCount ? availableForFill / fillCount : 0;

  let cursor = horizontal ? paddingLeft : paddingTop;
  for (const node of result) {
    const mainMode = horizontal ? node.layout?.widthMode : node.layout?.heightMode;
    const crossMode = horizontal ? node.layout?.heightMode : node.layout?.widthMode;
    if (mainMode === "fill") {
      if (horizontal) node.width = sizeWithin(fillSize, node.constraints?.minWidth, node.constraints?.maxWidth);
      else node.height = sizeWithin(fillSize, node.constraints?.minHeight, node.constraints?.maxHeight);
    }
    if (crossMode === "fill" || layout.align === "stretch") {
      if (horizontal) node.height = sizeWithin(crossAvailable, node.constraints?.minHeight, node.constraints?.maxHeight);
      else node.width = sizeWithin(crossAvailable, node.constraints?.minWidth, node.constraints?.maxWidth);
    }

    const crossSize = horizontal ? node.height : node.width;
    let cross = horizontal ? paddingTop : paddingLeft;
    if (layout.align === "center") cross += (crossAvailable - crossSize) / 2;
    if (layout.align === "end") cross += crossAvailable - crossSize;

    if (horizontal) {
      node.x = Math.round(cursor);
      node.y = Math.round(cross);
      cursor += node.width + gap;
    } else {
      node.x = Math.round(cross);
      node.y = Math.round(cursor);
      cursor += node.height + gap;
    }
  }

  const contentMain = Math.max(0, cursor - gap + (horizontal ? paddingRight : paddingBottom));
  const contentCross = Math.max(
    0,
    ...result.map((node) => (horizontal ? node.height : node.width)),
  ) + (horizontal ? paddingTop + paddingBottom : paddingLeft + paddingRight);

  const width = layout.widthMode === "hug" ? (horizontal ? contentMain : contentCross) : container.width;
  const height = layout.heightMode === "hug" ? (horizontal ? contentCross : contentMain) : container.height;
  return { container: { width: Math.round(width), height: Math.round(height) }, nodes: result };
}

export function applyAutoLayout(nodes: DesignNode[], containerId: string): DesignNode[] {
  const next = structuredClone(nodes);
  const container = next.find((node) => node.id === containerId);
  if (!container) throw new Error(`Container not found: ${containerId}`);
  const childIds = container.children || [];
  const children = childIds.map((id) => next.find((node) => node.id === id)).filter((node): node is DesignNode => !!node);
  const laidOut = layoutChildren(container, children);
  container.width = laidOut.container.width;
  container.height = laidOut.container.height;
  for (const child of laidOut.nodes) {
    const index = next.findIndex((node) => node.id === child.id);
    if (index >= 0) next[index] = child;
  }
  return next;
}
