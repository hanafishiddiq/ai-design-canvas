import type { DesignNode, DesignPage, DesignProject } from "./types";

export interface RuntimeNodeSnapshot {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;
  background?: string;
  fontSize?: number;
  fontWeight?: number;
  radius?: number;
  visible?: boolean;
}

export interface RuntimePageSnapshot {
  pageId: string;
  route?: string;
  viewport: { width: number; height: number };
  capturedAt: string;
  nodes: RuntimeNodeSnapshot[];
}

export type QaIssueKind = "missing" | "unexpected" | "geometry" | "content" | "style" | "visibility";
export interface QaIssue {
  kind: QaIssueKind;
  severity: "info" | "warning" | "error";
  nodeId: string;
  message: string;
  design?: unknown;
  runtime?: unknown;
}
export interface QaReport {
  pageId: string;
  score: number;
  matched: number;
  designNodes: number;
  runtimeNodes: number;
  issues: QaIssue[];
}

const delta = (a: number, b: number) => Math.abs(a - b);
const styleValue = (value?: string) => value?.toLowerCase().trim();
const numericClose = (a: number | undefined, b: number | undefined, tolerance = 1) => a === undefined || b === undefined || delta(a, b) <= tolerance;

function expectedAbsolute(node: DesignNode, page: DesignPage): { x: number; y: number } {
  let x = node.x;
  let y = node.y;
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = page.nodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

export function compareRuntimeSnapshot(project: DesignProject, snapshot: RuntimePageSnapshot, tolerancePx = 4): QaReport {
  const page = project.pages.find((item) => item.id === snapshot.pageId);
  if (!page) throw new Error(`Page not found: ${snapshot.pageId}`);
  const runtimeById = new Map(snapshot.nodes.map((node) => [node.nodeId, node]));
  const designById = new Map(page.nodes.map((node) => [node.id, node]));
  const issues: QaIssue[] = [];
  let matched = 0;

  for (const node of page.nodes) {
    const runtime = runtimeById.get(node.id);
    if (!runtime) {
      issues.push({ kind: "missing", severity: "error", nodeId: node.id, message: `${node.name} is missing from the runtime manifest.` });
      continue;
    }
    matched += 1;
    const expected = expectedAbsolute(node, page);
    const geometryDiff = { x: delta(expected.x, runtime.x), y: delta(expected.y, runtime.y), width: delta(node.width, runtime.width), height: delta(node.height, runtime.height) };
    if (Math.max(geometryDiff.x, geometryDiff.y, geometryDiff.width, geometryDiff.height) > tolerancePx) {
      issues.push({ kind: "geometry", severity: Math.max(...Object.values(geometryDiff)) > tolerancePx * 3 ? "error" : "warning", nodeId: node.id, message: `${node.name} geometry drift: Δx ${geometryDiff.x}px, Δy ${geometryDiff.y}px, Δw ${geometryDiff.width}px, Δh ${geometryDiff.height}px.`, design: { ...expected, width: node.width, height: node.height }, runtime });
    }
    if (node.text !== undefined && runtime.text !== undefined && node.text.trim() !== runtime.text.trim()) issues.push({ kind: "content", severity: "warning", nodeId: node.id, message: `${node.name} text differs from the design.`, design: node.text, runtime: runtime.text });
    const styleMismatches: string[] = [];
    if (node.style.color && runtime.color && styleValue(node.style.color) !== styleValue(runtime.color)) styleMismatches.push(`color ${node.style.color}→${runtime.color}`);
    if (node.style.background && runtime.background && styleValue(node.style.background) !== styleValue(runtime.background)) styleMismatches.push(`background ${node.style.background}→${runtime.background}`);
    if (!numericClose(node.style.fontSize, runtime.fontSize)) styleMismatches.push(`font ${node.style.fontSize}px→${runtime.fontSize}px`);
    if (!numericClose(node.style.fontWeight, runtime.fontWeight, 25)) styleMismatches.push(`weight ${node.style.fontWeight}→${runtime.fontWeight}`);
    if (!numericClose(node.style.radius, runtime.radius)) styleMismatches.push(`radius ${node.style.radius}px→${runtime.radius}px`);
    if (styleMismatches.length) issues.push({ kind: "style", severity: "warning", nodeId: node.id, message: `${node.name}: ${styleMismatches.join(", ")}.` });
    const expectedVisible = (node.style.opacity ?? 1) > 0;
    if (runtime.visible !== undefined && runtime.visible !== expectedVisible) issues.push({ kind: "visibility", severity: "warning", nodeId: node.id, message: `${node.name} visibility differs from the design.` });
  }

  for (const runtime of snapshot.nodes) if (!designById.has(runtime.nodeId)) issues.push({ kind: "unexpected", severity: "info", nodeId: runtime.nodeId, message: `Runtime node ${runtime.nodeId} has no matching design node.` });

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const info = issues.length - errors - warnings;
  const score = Math.max(0, Math.round(100 - errors * 10 - warnings * 3 - info));
  return { pageId: page.id, score, matched, designNodes: page.nodes.length, runtimeNodes: snapshot.nodes.length, issues };
}

/** Browser helper for generated/instrumented pages that preserve data-page-id and data-node-id. */
export function captureRuntimeManifest(root: ParentNode = document, pageId: string, route = location.pathname): RuntimePageSnapshot {
  const pageSelector = `[data-page-id="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(pageId) : pageId.replace(/"/g, "\\\"")}"]`;
  const pageRoot = root.querySelector<HTMLElement>(pageSelector);
  const pageRect = pageRoot?.getBoundingClientRect();
  const scope: ParentNode = pageRoot || root;
  const elements = [...scope.querySelectorAll<HTMLElement>("[data-node-id]")];
  const nodes = elements.map((element): RuntimeNodeSnapshot => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      nodeId: element.dataset.nodeId || "",
      x: Math.round(rect.x - (pageRect?.x || 0)),
      y: Math.round(rect.y - (pageRect?.y || 0)),
      width: Math.round(rect.width), height: Math.round(rect.height),
      text: element.textContent?.trim() || undefined,
      color: style.color || undefined,
      background: style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" ? style.backgroundColor : undefined,
      fontSize: Number.parseFloat(style.fontSize) || undefined,
      fontWeight: Number.parseFloat(style.fontWeight) || undefined,
      radius: Number.parseFloat(style.borderRadius) || undefined,
      visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0,
    };
  }).filter((node) => node.nodeId);
  return { pageId, route, viewport: { width: innerWidth, height: innerHeight }, capturedAt: new Date().toISOString(), nodes };
}
