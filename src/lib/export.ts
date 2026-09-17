import type { DesignPage, DesignProject } from "./types";

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

export function exportPageHtml(project: DesignProject, page: DesignPage): string {
  const nodes = page.nodes.map((node) => {
    const s = node.style;
    const styles = [
      "position:absolute", `left:${node.x}px`, `top:${node.y}px`, `width:${node.width}px`, `height:${node.height}px`,
      s.background ? `background:${s.background}` : "", s.color ? `color:${s.color}` : "",
      s.borderColor ? `border:${s.borderWidth || 1}px solid ${s.borderColor}` : "",
      s.radius != null ? `border-radius:${s.radius}px` : "", s.padding != null ? `padding:${s.padding}px` : "",
      s.fontSize ? `font-size:${s.fontSize}px` : "", s.fontWeight ? `font-weight:${s.fontWeight}` : "",
      "box-sizing:border-box", "white-space:pre-line", "overflow:hidden", "display:flex", "align-items:center",
      s.align === "center" ? "justify-content:center;text-align:center" : "",
    ].filter(Boolean).join(";");
    const tag = node.type === "button" ? "button" : "div";
    return `<${tag} style="${styles}">${escapeHtml(node.text || (node.type === "card" ? "" : node.name))}</${tag}>`;
  }).join("\n    ");

  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.name)}</title></head>\n<body style="margin:0;background:${project.tokens.colors.background};font-family:${project.tokens.typography.fontFamily};display:grid;place-items:center;min-height:100vh">\n  <main style="position:relative;width:${page.width}px;height:${page.height}px;background:${page.background};overflow:hidden">\n    ${nodes}\n  </main>\n</body></html>`;
}
