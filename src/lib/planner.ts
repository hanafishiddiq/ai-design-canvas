import { generateTokens } from "./foundations";
import { serializeDesignMd } from "./design-md";
import { createSystemVariableCollections } from "./variables";
import type { DesignDirection, DesignNode, DesignPage, DesignProject, FlowEdge } from "./types";

let counter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
const semantic = <T extends DesignNode>(node: T): T => ({ ...node, layout: node.layout || { mode: "absolute" }, constraints: node.constraints || { horizontal: "left", vertical: "top" } });

function text(name: string, value: string, x: number, y: number, width: number, fontSize: number, color: string, weight = 500): DesignNode {
  return semantic({ id: uid("text"), type: "text", name, text: value, x, y, width, height: Math.max(24, fontSize * 1.35), style: { color, fontSize, fontWeight: weight } });
}
function card(name: string, x: number, y: number, width: number, height: number, surface: string, border: string, radius: number): DesignNode {
  return semantic({ id: uid("card"), type: "card", name, x, y, width, height, style: { background: surface, borderColor: border, borderWidth: 1, radius, padding: 16 } });
}
function button(name: string, label: string, x: number, y: number, width: number, accent: string, accentText: string, radius: number, targetPageId?: string): DesignNode {
  return semantic({ id: uid("button"), type: "button", name, text: label, x, y, width, height: 38, style: { background: accent, color: accentText, radius, padding: 12, fontSize: 13, fontWeight: 650, align: "center" }, action: targetPageId ? { type: "navigate", targetPageId } : undefined });
}
function input(name: string, placeholder: string, x: number, y: number, width: number, surface: string, border: string, textColor: string, radius: number): DesignNode {
  return semantic({ id: uid("input"), type: "input", name, text: placeholder, x, y, width, height: 40, style: { background: surface, borderColor: border, borderWidth: 1, color: textColor, radius, padding: 12, fontSize: 13 } });
}

function inferScreenNames(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const screens = ["Sign in", "Overview"];
  if (/shop|commerce|store|order|product/.test(lower)) screens.push("Orders");
  else if (/crm|customer|sales|lead/.test(lower)) screens.push("Customers");
  else if (/analytics|metric|data|dashboard/.test(lower)) screens.push("Analytics");
  else if (/project|task|team|workspace/.test(lower)) screens.push("Projects");
  else screens.push("Activity");
  screens.push(/billing|payment|finance/.test(lower) ? "Billing" : "Settings");
  return screens;
}

function makePage(name: string, index: number, tokens: ReturnType<typeof generateTokens>): DesignPage {
  const id = uid("page");
  const width = 720;
  const height = 460;
  const x = 80 + (index % 2) * 820;
  const y = 80 + Math.floor(index / 2) * 560;
  const nodes: DesignNode[] = [];
  const t = tokens;

  if (name === "Sign in") {
    nodes.push(text("Eyebrow", "AI DESIGN CANVAS", 72, 70, 280, 11, t.colors.muted, 700));
    nodes.push(text("Title", "Design products with a system, not a vibe.", 72, 110, 520, 36, t.colors.text, 700));
    nodes.push(text("Body", "Start from a durable design contract, then iterate visually.", 72, 166, 460, 15, t.colors.muted, 450));
    nodes.push(input("Email", "you@company.com", 72, 236, 330, t.colors.surfaceElevated, t.colors.border, t.colors.muted, t.radius.md));
    nodes.push(input("Password", "••••••••", 72, 288, 330, t.colors.surfaceElevated, t.colors.border, t.colors.muted, t.radius.md));
    nodes.push(button("Continue", "Continue", 72, 344, 140, t.colors.accent, t.colors.accentText, t.radius.md));
  } else {
    nodes.push(text("Section label", name.toUpperCase(), 42, 34, 220, 10, t.colors.muted, 750));
    nodes.push(text("Page title", name, 42, 58, 420, 28, t.colors.text, 700));
    nodes.push(text("Page summary", `A focused ${name.toLowerCase()} workspace generated from the product brief.`, 42, 98, 520, 13, t.colors.muted, 450));
    nodes.push(button("Primary action", name === "Settings" ? "Save changes" : "Create new", 538, 50, 130, t.colors.accent, t.colors.accentText, t.radius.md));
    nodes.push(card("Primary metric", 42, 150, 190, 112, t.colors.surfaceElevated, t.colors.border, t.radius.lg));
    nodes.push(text("Metric label", "Active", 60, 168, 120, 11, t.colors.muted, 600));
    nodes.push(text("Metric value", index % 2 ? "1,284" : "74.2%", 60, 194, 140, 27, t.colors.text, 700));
    nodes.push(card("Secondary metric", 246, 150, 190, 112, t.colors.surfaceElevated, t.colors.border, t.radius.lg));
    nodes.push(text("Metric label 2", "This week", 264, 168, 120, 11, t.colors.muted, 600));
    nodes.push(text("Metric value 2", "+18.6%", 264, 194, 140, 27, t.colors.text, 700));
    nodes.push(card("Main data", 42, 280, 626, 132, t.colors.surface, t.colors.border, t.radius.lg));
    nodes.push(text("Table heading", "Recent activity", 60, 300, 180, 13, t.colors.text, 650));
    nodes.push(text("Table content", "Design contract synced  ·  2m ago\nCanvas refined  ·  12m ago\nPrototype flow updated  ·  31m ago", 60, 330, 500, 12, t.colors.muted, 450));
  }
  return { id, name, route: name === "Sign in" ? "/login" : `/${name.toLowerCase().replace(/\s+/g, "-")}`, x, y, width, height, background: t.colors.background, nodes };
}

export function planProject(prompt: string, direction: DesignDirection, name = "Untitled product"): DesignProject {
  const tokens = generateTokens(direction);
  const pages = inferScreenNames(prompt).map((screenName, index) => makePage(screenName, index, tokens));
  const overview = pages[1];
  const signInButton = pages[0].nodes.find((node) => node.type === "button");
  if (signInButton) signInButton.action = { type: "navigate", targetPageId: overview.id };
  const flows: FlowEdge[] = signInButton ? [{ id: uid("flow"), fromPageId: pages[0].id, fromNodeId: signInButton.id, toPageId: overview.id, label: "Continue" }] : [];
  const now = new Date().toISOString();
  const project: DesignProject = {
    id: uid("project"),
    name,
    prompt,
    createdAt: now,
    updatedAt: now,
    version: 5,
    direction,
    tokens,
    designMd: "",
    pages,
    flows,
    components: {},
    variables: createSystemVariableCollections(direction),
    references: [],
    review: { status: "draft", threads: [] },
    codeMappings: [],
    activePageId: pages[0].id,
  };
  project.designMd = serializeDesignMd(name, direction, tokens);
  return project;
}
