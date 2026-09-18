import type { DesignProject } from "./types";

export const CANVAS_FOCUS_EVENT = "ai-design-canvas:focus-node";

export type CommandItem =
  | { id: string; kind: "page"; label: string; detail: string; pageId: string; search: string }
  | { id: string; kind: "node"; label: string; detail: string; pageId: string; nodeId: string; search: string }
  | { id: string; kind: "component"; label: string; detail: string; pageId?: string; nodeId?: string; search: string };

export function projectCommandItems(project: DesignProject): CommandItem[] {
  const items: CommandItem[] = [];
  for (const page of project.pages) {
    items.push({
      id: "page:" + page.id,
      kind: "page",
      label: page.name,
      detail: "Screen · " + page.route,
      pageId: page.id,
      search: (page.name + " " + page.route + " screen page").toLowerCase(),
    });
    for (const node of page.nodes) {
      items.push({
        id: "node:" + page.id + ":" + node.id,
        kind: "node",
        label: node.name,
        detail: page.name + " · " + node.type + (node.text ? " · " + node.text.slice(0, 60) : ""),
        pageId: page.id,
        nodeId: node.id,
        search: (node.name + " " + node.type + " " + (node.text || "") + " " + page.name + " " + page.route).toLowerCase(),
      });
    }
  }
  for (const component of Object.values(project.components)) {
    let pageId: string | undefined;
    let nodeId: string | undefined;
    outer: for (const page of project.pages) {
      for (const node of page.nodes) {
        if (node.component?.componentId === component.id) {
          pageId = page.id;
          nodeId = node.id;
          break outer;
        }
      }
    }
    items.push({
      id: "component:" + component.id,
      kind: "component",
      label: component.name,
      detail: pageId ? "Component · jump to instance" : "Component · no placed instance",
      pageId,
      nodeId,
      search: (component.name + " component reusable").toLowerCase(),
    });
  }
  return items;
}

export function filterCommandItems(items: CommandItem[], query: string, limit = 80) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return items.slice(0, limit);
  return items
    .map((item) => {
      let score = 0;
      for (const term of terms) {
        const index = item.search.indexOf(term);
        if (index < 0) return null;
        score += index === 0 ? 20 : Math.max(1, 12 - Math.min(index, 11));
        if (item.label.toLowerCase().startsWith(term)) score += 15;
      }
      if (item.kind === "page") score += 3;
      return { item, score };
    })
    .filter((value): value is { item: CommandItem; score: number } => !!value)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map(({ item }) => item);
}
