"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { DesignNode } from "@/lib/types";

function nodeStyle(node: DesignNode, selected: boolean): CSSProperties {
  const style = node.style;
  return {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    background: style.background,
    color: style.color,
    border: style.borderColor ? `${style.borderWidth || 1}px solid ${style.borderColor}` : node.type === "frame" ? "1px dashed #39414e" : undefined,
    borderRadius: style.radius,
    padding: style.padding,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    opacity: style.opacity,
    display: node.type === "frame" ? "block" : "flex",
    alignItems: node.type === "text" ? "flex-start" : "center",
    justifyContent: style.align === "center" ? "center" : "flex-start",
    textAlign: style.align,
    whiteSpace: "pre-line",
    lineHeight: 1.35,
    overflow: "visible",
    userSelect: "none",
    boxSizing: "border-box",
    outline: selected ? "2px solid #7c8cff" : undefined,
    outlineOffset: selected ? 2 : undefined,
    cursor: "default",
  };
}

export interface StudioNodeProps {
  node: DesignNode;
  allNodes: DesignNode[];
  selectedIds: string[];
  interactive?: boolean;
  onSelect?: (node: DesignNode, additive: boolean) => void;
  onDragStart?: (event: ReactPointerEvent<HTMLDivElement>, node: DesignNode) => void;
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>, node: DesignNode) => void;
  onAction?: (node: DesignNode) => void;
}

export function StudioNode({ node, allNodes, selectedIds, interactive = true, onSelect, onDragStart, onResizeStart, onAction }: StudioNodeProps) {
  const selected = selectedIds.includes(node.id);
  const children = (node.children || []).map((id) => allNodes.find((item) => item.id === id)).filter((item): item is DesignNode => !!item);
  return (
    <div
      data-node-id={node.id}
      style={nodeStyle(node, selected)}
      onPointerDown={interactive ? (event) => {
        event.stopPropagation();
        onSelect?.(node, event.shiftKey || event.metaKey || event.ctrlKey);
        onDragStart?.(event, node);
      } : undefined}
      onDoubleClick={interactive && node.action ? (event) => { event.stopPropagation(); onAction?.(node); } : undefined}
      title={`${node.name}${node.component ? ` · ${node.component.componentId}` : ""}`}
    >
      {node.type === "frame" && <div className="pointer-events-none absolute -top-5 left-0 text-[9px] text-[#717b8b]">{node.name} · {node.layout?.mode || "absolute"}</div>}
      {node.type !== "frame" && (node.text || (node.type === "card" ? "" : node.name))}
      {children.map((child) => (
        <StudioNode
          key={child.id}
          node={child}
          allNodes={allNodes}
          selectedIds={selectedIds}
          interactive={interactive}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onResizeStart={onResizeStart}
          onAction={onAction}
        />
      ))}
      {interactive && selected && selectedIds.length === 1 && (
        <div
          className="absolute -bottom-1.5 -right-1.5 size-3 rounded-sm border border-white bg-[#7c8cff] shadow"
          style={{ cursor: "nwse-resize" }}
          onPointerDown={(event) => { event.stopPropagation(); onResizeStart?.(event, node); }}
        />
      )}
    </div>
  );
}

export function StudioNodeLayer(props: Omit<StudioNodeProps, "node">) {
  const roots = props.allNodes.filter((node) => !node.parentId);
  return <>{roots.map((node) => <StudioNode key={node.id} {...props} node={node} />)}</>;
}
