"use client";

import { useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { resolveNodePresentation } from "@/lib/interaction-states";
import type { DesignNode, InteractionVisualState, NodeStyle } from "@/lib/types";

function nodeStyle(node: DesignNode, selected: boolean, style: NodeStyle = node.style): CSSProperties {
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
  previewMode?: boolean;
  onSelect?: (node: DesignNode, additive: boolean) => void;
  onDragStart?: (event: ReactPointerEvent<HTMLDivElement>, node: DesignNode) => void;
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>, node: DesignNode) => void;
  onAction?: (node: DesignNode) => void;
}

export function StudioNode({ node, allNodes, selectedIds, interactive = true, previewMode = false, onSelect, onDragStart, onResizeStart, onAction }: StudioNodeProps) {
  const selected = selectedIds.includes(node.id);
  const initialState = node.previewState || "hover";
  const [visualState, setVisualState] = useState<InteractionVisualState | "default">(previewMode && node.previewState ? node.previewState : "default");
  const presentation = resolveNodePresentation(node, previewMode ? visualState : "default");
  const lockedState = visualState === "disabled" || node.previewState === "disabled";
  const children = (node.children || []).map((id) => allNodes.find((item) => item.id === id)).filter((item): item is DesignNode => !!item);
  return (
    <div
      data-node-id={node.id}
      style={nodeStyle(node, selected, presentation.style)}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? node.name + ", " + node.type : undefined}
      onPointerEnter={previewMode && !lockedState && node.states?.hover ? () => setVisualState("hover") : undefined}
      onPointerLeave={previewMode && !lockedState ? () => setVisualState(node.previewState || "default") : undefined}
      onPointerDown={interactive ? (event) => {
        event.stopPropagation();
        if (previewMode) {
          if (!lockedState && node.states?.pressed) setVisualState("pressed");
          return;
        }
        onSelect?.(node, event.shiftKey || event.metaKey || event.ctrlKey);
        onDragStart?.(event, node);
      } : undefined}
      onPointerUp={previewMode && !lockedState ? () => setVisualState(node.states?.hover ? "hover" : node.previewState || "default") : undefined}
      onClick={previewMode && node.action && !lockedState ? (event) => { event.stopPropagation(); onAction?.(node); } : undefined}
      onDoubleClick={!previewMode && interactive && node.action ? (event) => { event.stopPropagation(); onAction?.(node); } : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onSelect?.(node, false);
        if (event.key === "Enter" && node.action) onAction?.(node);
      } : undefined}
      title={`${node.name}${node.component ? ` · ${node.component.componentId}` : ""}`}
    >
      {node.type === "frame" && <div className="pointer-events-none absolute -top-5 left-0 text-[9px] text-[#717b8b]">{node.name} · {node.layout?.mode || "absolute"}</div>}
      {node.type !== "frame" && (presentation.text || (node.type === "card" ? "" : node.name))}
      {children.map((child) => (
        <StudioNode
          key={child.id}
          node={child}
          allNodes={allNodes}
          selectedIds={selectedIds}
          interactive={interactive}
          previewMode={previewMode}
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
