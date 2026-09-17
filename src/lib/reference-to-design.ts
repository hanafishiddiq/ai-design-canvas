import type { AutoLayoutSpec, DesignNode, DesignPage, DesignReference, DesignTokens } from "./types";

let count = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(count++).toString(36)}`;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reference";

function frame(name: string, x: number, y: number, width: number, height: number, tokens: DesignTokens, layout: "absolute" | "horizontal" | "vertical" = "absolute"): DesignNode {
  return {
    id: uid("frame"), type: "frame", name, x, y, width, height,
    style: { background: tokens.colors.surface, borderColor: tokens.colors.border, borderWidth: 1, radius: tokens.radius.md, padding: 16 },
    children: [], layout: { mode: layout, gap: 12, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, align: "stretch", widthMode: "fixed", heightMode: "fixed" },
    constraints: { horizontal: "left-right", vertical: "top" },
  };
}
function text(name: string, content: string, x: number, y: number, width: number, size: number, tokens: DesignTokens): DesignNode {
  return { id: uid("text"), type: "text", name, text: content, x, y, width, height: Math.max(20, size * 1.4), style: { color: tokens.colors.text, fontSize: size, fontWeight: size >= 22 ? 700 : 500 }, layout: { mode: "absolute", widthMode: "fixed", heightMode: "hug" }, constraints: { horizontal: "left", vertical: "top" } };
}
function attach(parent: DesignNode, child: DesignNode, relativeX: number, relativeY: number) {
  child.parentId = parent.id; child.x = relativeX; child.y = relativeY; parent.children = [...(parent.children || []), child.id];
}
function mergeLayout(node: DesignNode, changes: Partial<AutoLayoutSpec>, fallback: AutoLayoutSpec["mode"] = "vertical"): AutoLayoutSpec {
  return { mode: node.layout?.mode ?? fallback, ...node.layout, ...changes };
}

/**
 * Local semantic fallback for screenshots/sketches. It uses aspect ratio and
 * extracted visual weight to propose a conventional information architecture;
 * it intentionally does not claim pixel-level visual understanding.
 */
export function referenceToDraftPage(reference: DesignReference, tokens: DesignTokens, canvasX = 0, canvasY = 0): DesignPage {
  const sourceRatio = reference.analysis.aspectRatio || 1.6;
  const width = sourceRatio < 0.8 ? 390 : sourceRatio < 1.2 ? 600 : 720;
  const height = Math.round(width / sourceRatio);
  const safeHeight = Math.max(460, Math.min(900, height));
  const nodes: DesignNode[] = [];
  const label = reference.kind === "sketch" ? "Sketch-derived draft" : "Reference-derived draft";
  const title = text("Reference title", reference.name, 36, 32, width - 72, 28, tokens);
  title.style.color = tokens.colors.text;
  const note = text("Reference note", `${label} · ${reference.analysis.width}×${reference.analysis.height} · ${reference.analysis.contrast} contrast`, 36, 76, width - 72, 11, tokens);
  note.style.color = tokens.colors.muted;
  nodes.push(title, note);

  const contentTop = 116;
  const availableHeight = safeHeight - contentTop - 32;
  const wide = width >= 680;
  const sidebarWidth = wide ? 150 : 0;
  if (wide) {
    const sidebar = frame("Navigation", 36, contentTop, sidebarWidth, availableHeight, tokens, "vertical");
    sidebar.constraints = { horizontal: "left", vertical: "top-bottom" };
    const navTitle = text("Navigation label", "Navigation", 0, 0, sidebarWidth - 32, 12, tokens);
    navTitle.style.color = tokens.colors.muted;
    const nav1 = text("Navigation item", "Overview", 0, 0, sidebarWidth - 32, 13, tokens);
    const nav2 = text("Navigation item", "Activity", 0, 0, sidebarWidth - 32, 13, tokens);
    attach(sidebar, navTitle, 16, 16); attach(sidebar, nav1, 16, 48); attach(sidebar, nav2, 16, 80);
    nodes.push(sidebar, navTitle, nav1, nav2);
  }

  const mainX = wide ? 36 + sidebarWidth + 16 : 24;
  const mainWidth = width - mainX - (wide ? 36 : 24);
  const main = frame("Primary content", mainX, contentTop, mainWidth, availableHeight, tokens, "vertical");
  main.constraints = { horizontal: "left-right", vertical: "top-bottom" };
  main.style.background = tokens.colors.background;
  const hero = frame("Primary region", 0, 0, mainWidth - 32, Math.max(110, availableHeight * .34), tokens, "vertical");
  hero.layout = mergeLayout(hero, { widthMode: "fill", heightMode: "fixed" });
  const heroTitle = text("Primary heading", reference.kind === "sketch" ? "Primary section" : "Match the reference hierarchy", 0, 0, mainWidth - 64, 20, tokens);
  const heroBody = text("Primary body", "Use the visual reference to guide hierarchy, density and composition. Refine content and components on the canvas.", 0, 0, mainWidth - 64, 12, tokens);
  heroBody.style.color = tokens.colors.muted;
  attach(hero, heroTitle, 16, 16); attach(hero, heroBody, 16, 52);
  attach(main, hero, 16, 16);

  const row = frame("Content row", 0, 0, mainWidth - 32, 118, tokens, wide ? "horizontal" : "vertical");
  row.layout = mergeLayout(row, { widthMode: "fill", heightMode: "fixed", gap: 12 }, wide ? "horizontal" : "vertical");
  row.style.background = "transparent"; row.style.borderColor = "transparent";
  for (let i = 0; i < (wide ? 3 : 2); i += 1) {
    const card = frame(`Reference card ${i + 1}`, 0, 0, wide ? 130 : mainWidth - 64, wide ? 86 : 48, tokens, "vertical");
    card.layout = mergeLayout(card, { widthMode: "fill", heightMode: "fixed", paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10 });
    const cardLabel = text("Card label", `Block ${i + 1}`, 0, 0, 100, 11, tokens);
    attach(card, cardLabel, 10, 10); attach(row, card, 0, 0); nodes.push(card, cardLabel);
  }
  attach(main, row, 16, Math.max(142, availableHeight * .34 + 28));
  nodes.push(main, hero, heroTitle, heroBody, row);

  return {
    id: uid("page"),
    name: `${reference.name} draft`,
    route: `/reference-${slug(reference.name)}`,
    x: canvasX,
    y: canvasY,
    width,
    height: safeHeight,
    background: tokens.colors.background,
    nodes,
  };
}
