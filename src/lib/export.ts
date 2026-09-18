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

function sizing(mode: string | undefined, value: number) {
  if (mode === "fill") return "100%";
  if (mode === "hug") return "fit-content";
  return `${value}px`;
}

function styleObject(node: DesignNode, parent?: DesignNode): Record<string, string | number> {
  const s = node.style;
  const autoChild = parent?.layout?.mode === "horizontal" || parent?.layout?.mode === "vertical";
  const style: Record<string, string | number> = { boxSizing: "border-box", width: sizing(node.layout?.widthMode, node.width), height: sizing(node.layout?.heightMode, node.height) };
  if (!autoChild) { style.position = "absolute"; style.left = node.x; style.top = node.y; }
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
  if (node.type === "input") return `<input data-node-id="${escapeHtml(node.id)}" aria-label="${escapeHtml(node.name)}" placeholder="${escapeHtml(node.text || "")}" style="${style}">`;
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
  if (node.type === "input") return `${indent}<input data-node-id="${node.id}" aria-label={\`${escapeJs(node.name)}\`} placeholder={\`${escapeJs(node.text || "")}\`} style={${style}} />`;
  const tag = node.type === "button" ? "button" : node.type === "text" ? "span" : node.type === "divider" ? "hr" : "div";
  if (tag === "hr") return `${indent}<hr data-node-id="${node.id}" style={${style}} />`;
  if (node.type === "text" || node.type === "button") return `${indent}<${tag} data-node-id="${node.id}" style={${style}}>{\`${escapeJs(node.text || "")}\`}</${tag}>`;
  const body = nested.map((child) => renderReactNode(page, child, node, depth + 1)).join("\n");
  return `${indent}<${tag} data-node-id="${node.id}" style={${style}}>\n${body}\n${indent}</${tag}>`;
}

export function exportProjectJson(project: DesignProject) { return serializeProject(project); }

export function exportPageHtml(project: DesignProject, page: DesignPage): string {
  const nodes = roots(page).map((node) => renderHtmlNode(page, node)).join("\n    ");
  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.name)}</title></head>\n<body style="margin:0;background:${project.tokens.colors.background};font-family:${project.tokens.typography.fontFamily};display:grid;place-items:center;min-height:100vh">\n  <main data-page-id="${escapeHtml(page.id)}" style="position:relative;width:${page.width}px;height:${page.height}px;background:${page.background};overflow:hidden">\n    ${nodes}\n  </main>\n</body></html>`;
}

export function exportPageReact(project: DesignProject, page: DesignPage): string {
  const componentName = page.name.replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join("") || "GeneratedScreen";
  const nodes = roots(page).map((node) => renderReactNode(page, node)).join("\n");
  const mainStyle = jsStyle({ position: "relative", width: `${page.width}px`, height: `${page.height}px`, background: page.background, overflow: "hidden", fontFamily: project.tokens.typography.fontFamily });
  return `import type { CSSProperties } from "react";\n\nexport function ${componentName}() {\n  return (\n    <main data-page-id="${page.id}" style={${mainStyle} as CSSProperties}>\n${nodes}\n    </main>\n  );\n}\n`;
}


function svgNode(page: DesignPage, node: DesignNode): string {
  const nested = children(page, node).map((child) => svgNode(page, child)).join("");
  const fill = node.style.background || "transparent";
  const stroke = node.style.borderColor || "none";
  const strokeWidth = node.style.borderColor ? node.style.borderWidth || 1 : 0;
  const radius = node.style.radius || 0;
  const opacity = node.style.opacity ?? 1;
  const textFill = node.style.color || "#111111";
  const fontSize = node.style.fontSize || 14;
  const fontWeight = node.style.fontWeight || 400;
  const label = escapeHtml(node.text || (node.type === "frame" || node.type === "card" ? "" : node.name));
  if (node.type === "text") {
    return `<text data-node-id="${escapeHtml(node.id)}" x="${node.x}" y="${node.y + fontSize}" fill="${escapeHtml(textFill)}" font-size="${fontSize}" font-weight="${fontWeight}" opacity="${opacity}">${label}</text>`;
  }
  if (node.type === "divider") {
    return `<line data-node-id="${escapeHtml(node.id)}" x1="${node.x}" y1="${node.y + node.height / 2}" x2="${node.x + node.width}" y2="${node.y + node.height / 2}" stroke="${escapeHtml(node.style.borderColor || textFill)}" stroke-width="${Math.max(1, node.style.borderWidth || 1)}" opacity="${opacity}" />`;
  }
  const rect = `<rect width="${node.width}" height="${node.height}" rx="${radius}" fill="${escapeHtml(fill)}" stroke="${escapeHtml(stroke)}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;
  const text = label ? `<text x="${node.style.padding || 10}" y="${Math.min(node.height - 4, (node.style.padding || 10) + fontSize)}" fill="${escapeHtml(textFill)}" font-size="${fontSize}" font-weight="${fontWeight}">${label}</text>` : "";
  return `<g data-node-id="${escapeHtml(node.id)}" transform="translate(${node.x} ${node.y})">${rect}${text}${nested}</g>`;
}

export function exportPageSvg(project: DesignProject, page: DesignPage): string {
  const nodes = roots(page).map((node) => svgNode(page, node)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" data-page-id="${escapeHtml(page.id)}"><title>${escapeHtml(page.name)}</title><rect width="100%" height="100%" fill="${escapeHtml(page.background || project.tokens.colors.background)}" />${nodes}</svg>`;
}

export function exportDtcgTokens(project: DesignProject): string {
  const dimension = (value: number) => ({ "$type": "dimension", "$value": { value, unit: "px" } });
  const colors = Object.fromEntries(Object.entries(project.tokens.colors).map(([name, value]) => [name, { "$type": "color", "$value": value }]));
  const spacing = Object.fromEntries(project.tokens.spacing.map((value, index) => ["space-" + index, dimension(value)]));
  const radius = Object.fromEntries(Object.entries(project.tokens.radius).map(([name, value]) => [name, dimension(value)]));
  const payload = {
    "$description": "AI Design Canvas DTCG-compatible design tokens",
    color: { "$type": "color", ...colors },
    spacing,
    radius,
    typography: {
      fontFamily: { "$type": "fontFamily", "$value": project.tokens.typography.fontFamily.split(",").map((value) => value.trim()) },
      displayFamily: { "$type": "fontFamily", "$value": project.tokens.typography.displayFamily.split(",").map((value) => value.trim()) },
      baseSize: dimension(project.tokens.typography.baseSize),
      scale: { "$type": "number", "$value": project.tokens.typography.scale },
    },
    motion: {
      duration: { "$type": "duration", "$value": { value: project.tokens.motion.duration, unit: "ms" } },
      easing: { "$type": "cubicBezier", "$value": project.tokens.motion.easing },
    },
  };
  return JSON.stringify(payload, null, 2);
}
