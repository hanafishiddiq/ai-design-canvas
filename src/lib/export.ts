import { serializeProject } from "./serialization";
import type { DesignNode, DesignPage, DesignProject } from "./types";

export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
const escapeJs = (value: string) => value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const cssValue = (value?: string | number) => value === undefined ? undefined : String(value);

function sizing(mode: string | undefined, value: number) {
  if (mode === "fill") return "100%";
  if (mode === "hug") return "fit-content";
  return `${value}px`;
}

function styleObject(node: DesignNode, parent?: DesignNode): Record<string, string | number> {
  const s = node.style;
  const autoChild = parent?.layout?.mode === "horizontal" || parent?.layout?.mode === "vertical";
  const style: Record<string, string | number> = {
    boxSizing: "border-box",
    width: sizing(node.layout?.widthMode, node.width),
    height: sizing(node.layout?.heightMode, node.height),
  };
  if (!autoChild) {
    style.position = "absolute";
    style.left = node.x;
    style.top = node.y;
  }
  if (s.background) style.background = s.background;
  if (s.color) style.color = s.color;
  if (s.borderColor) style.border = `${s.borderWidth || 1}px solid ${s.borderColor}`;
  if (s.radius != null) style.borderRadius = s.radius;
  if (s.padding != null) style.padding = s.padding;
  if (s.fontSize) style.fontSize = s.fontSize;
  if (s.fontWeight) style.fontWeight = s.fontWeight;
  if (s.opacity != null) style.opacity = s.opacity;
  if (s.align) style.textAlign = s.align;
  if (node.layout?.mode === "horizontal" || node.layout?.mode === "vertical") {
    style.display = "flex";
    style.flexDirection = node.layout.mode === "horizontal" ? "row" : "column";
    style.gap = node.layout.gap ?? s.gap ?? 0;
    style.alignItems = node.layout.align === "start" ? "flex-start" : node.layout.align === "end" ? "flex-end" : node.layout.align || "stretch";
    style.justifyContent = node.layout.justify === "space-between" ? "space-between" : node.layout.justify === "start" ? "flex-start" : node.layout.justify === "end" ? "flex-end" : node.layout.justify || "flex-start";
    const top = node.layout.paddingTop ?? s.padding ?? 0;
    const right = node.layout.paddingRight ?? s.padding ?? 0;
    const bottom = node.layout.paddingBottom ?? s.padding ?? 0;
    const left = node.layout.paddingLeft ?? s.padding ?? 0;
    style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }
  return style;
}

function htmlStyle(style: Record<string, string | number>) {
  const names: Record<string, string> = { boxSizing: "box-sizing", borderRadius: "border-radius", fontSize: "font-size", fontWeight: "font-weight", textAlign: "text-align", flexDirection: "flex-direction", alignItems: "align-items", justifyContent: "justify-content" };
  return Object.entries(style).map(([key, value]) => `${names[key] || key}:${typeof value === "number" && !["fontWeight", "opacity"].includes(key) ? `${value}px` : value}`).join(";");
}

function roots(page: DesignPage) { return page.nodes.filter((node) => !node.parentId); }
function children(page: DesignPage, node: DesignNode) { return (node.children || []).map((id) => page.nodes.find((candidate) => candidate.id === id)).filter((candidate): candidate is DesignNode => !!candidate); }

function renderHtmlNode(page: DesignPage, node: DesignNode, parent?: DesignNode): string {
  const nested = children(page, node);
  const style = htmlStyle(styleObject(node, parent));
  if (node.type === "input") return `<input aria-label="${escapeHtml(node.name)}" placeholder="${escapeHtml(node.text || "")}" style="${style}">`;
  const tag = node.type === "button" ? "button" : node.type === "text" ? "span" : node.type === "divider" ? "hr" : "div";
  const content = node.type === "text" || node.type === "button" ? escapeHtml(node.text || "") : nested.map((child) => renderHtmlNode(page, child, node)).join("");
  return `<${tag} data-node-id="${escapeHtml(node.id)}" style="${style}">${content}</${tag}>`;
}

function jsStyle(style: Record<string, string | number>) {
  return JSON.stringify(style).replace(/"([A-Za-z_$][\w$]*)":/g, "$1:");
}

function renderReactNode(page: DesignPage, node: DesignNode, parent?: DesignNode, depth = 3): string {
  const indent = "  ".repeat(depth);
  const nested = children(page, node);
  const style = jsStyle(styleObject(node, parent));
  if (node.type === "input") return `${indent}<input aria-label={\`${escapeJs(node.name)}\`} placeholder={\`${escapeJs(node.text || "")}\`} style={${style}} />`;
  const tag = node.type === "button" ? "button" : node.type === "text" ? "span" : node.type === "divider" ? "hr" : "div";
  if (tag === "hr") return `${indent}<hr data-node-id="${node.id}" style={${style}} />`;
  if (node.type === "text" || node.type === "button") return `${indent}<${tag} data-node-id="${node.id}" style={${style}}>{\`${escapeJs(node.text || "")}\`}</${tag}>`;
  const body = nested.map((child) => renderReactNode(page, child, node, depth + 1)).join("\n");
  return `${indent}<${tag} data-node-id="${node.id}" style={${style}}>\n${body}\n${indent}</${tag}>`;
}

export function exportProjectJson(project: DesignProject) { return serializeProject(project); }

export function exportPageHtml(project: DesignProject, page: DesignPage): string {
  const nodes = roots(page).map((node) => renderHtmlNode(page, node)).join("\n    ");
  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.name)}</title></head>\n<body style="margin:0;background:${project.tokens.colors.background};font-family:${project.tokens.typography.fontFamily};display:grid;place-items:center;min-height:100vh">\n  <main style="position:relative;width:${page.width}px;height:${page.height}px;background:${page.background};overflow:hidden">\n    ${nodes}\n  </main>\n</body></html>`;
}

export function exportPageReact(project: DesignProject, page: DesignPage): string {
  const componentName = page.name.replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join("") || "GeneratedScreen";
  const nodes = roots(page).map((node) => renderReactNode(page, node)).join("\n");
  const mainStyle = jsStyle({ position: "relative", width: `${page.width}px`, height: `${page.height}px`, background: page.background, overflow: "hidden", fontFamily: project.tokens.typography.fontFamily });
  return `import type { CSSProperties } from "react";\n\nexport function ${componentName}() {\n  return (\n    <main style={${mainStyle} as CSSProperties}>\n${nodes}\n    </main>\n  );\n}\n`;
}
