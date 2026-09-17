import { describe, expect, it } from "vitest";
import { createComponentDefinition, instantiateComponent } from "../components";
import { defaultDirection } from "../foundations";
import { layoutChildren } from "../layout";
import { OperationHistory, applyOperation } from "../operations";
import { planProject } from "../planner";
import { adaptPageToViewport } from "../responsive";
import { migrateProject, validateProject } from "../schema";
import { createSystemVariableCollections, resolveVariable } from "../variables";
import type { DesignNode } from "../types";

describe("schema v2", () => {
  it("migrates a v1 project without losing pages", () => {
    const current = planProject("Analytics workspace", defaultDirection, "Atlas");
    const legacy = structuredClone(current) as unknown as Record<string, unknown>;
    legacy.version = 1;
    delete legacy.components;
    delete legacy.variables;
    const pagesBefore = (legacy.pages as unknown[]).length;
    const migrated = migrateProject(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.pages).toHaveLength(pagesBefore);
    expect(migrated.components).toEqual({});
    expect(migrated.variables).toEqual([]);
    expect(validateProject(migrated).valid).toBe(true);
  });
});

describe("reversible operations", () => {
  it("updates a node and supports undo/redo", () => {
    const project = planProject("Analytics workspace", defaultDirection, "Atlas");
    const page = project.pages[0];
    const node = page.nodes.find((item) => item.type === "text")!;
    const original = node.text;
    const history = new OperationHistory(project);
    const changed = history.execute({ type: "node.update", pageId: page.id, nodeId: node.id, changes: { text: "Changed" } }, "Rename copy");
    expect(changed.pages[0].nodes.find((item) => item.id === node.id)?.text).toBe("Changed");
    expect(history.undo().pages[0].nodes.find((item) => item.id === node.id)?.text).toBe(original);
    expect(history.redo().pages[0].nodes.find((item) => item.id === node.id)?.text).toBe("Changed");
  });

  it("inverts insert operations", () => {
    const project = planProject("Analytics workspace", defaultDirection, "Atlas");
    const page = project.pages[0];
    const node: DesignNode = { id: "test_node", type: "text", name: "Test", text: "Hello", x: 0, y: 0, width: 100, height: 20, style: {} };
    const inserted = applyOperation(project, { type: "node.insert", pageId: page.id, node });
    expect(inserted.project.pages[0].nodes.some((item) => item.id === node.id)).toBe(true);
    const reverted = applyOperation(inserted.project, inserted.inverse);
    expect(reverted.project.pages[0].nodes.some((item) => item.id === node.id)).toBe(false);
  });
});

describe("semantic auto-layout", () => {
  it("lays out fill children deterministically", () => {
    const container: DesignNode = {
      id: "container", type: "frame", name: "Row", x: 0, y: 0, width: 300, height: 80,
      style: { padding: 10 }, layout: { mode: "horizontal", gap: 10, align: "stretch" }, children: ["a", "b"],
    };
    const children: DesignNode[] = [
      { id: "a", type: "card", name: "A", x: 0, y: 0, width: 40, height: 20, style: {}, layout: { mode: "absolute", widthMode: "fill" } },
      { id: "b", type: "card", name: "B", x: 0, y: 0, width: 40, height: 20, style: {}, layout: { mode: "absolute", widthMode: "fill" } },
    ];
    const result = layoutChildren(container, children);
    expect(result.nodes[0].x).toBe(10);
    expect(result.nodes[1].x).toBeGreaterThan(result.nodes[0].x);
    expect(result.nodes[0].width).toBe(result.nodes[1].width);
    expect(result.nodes[0].height).toBe(60);
  });
});

describe("responsive constraints", () => {
  it("pins right-constrained nodes and stretches left-right nodes", () => {
    const project = planProject("Analytics workspace", defaultDirection, "Atlas");
    const page = structuredClone(project.pages[1]);
    const right = page.nodes[0];
    right.constraints = { horizontal: "right", vertical: "top" };
    const stretch = page.nodes[1];
    stretch.constraints = { horizontal: "left-right", vertical: "top" };
    const originalRightMargin = page.width - (right.x + right.width);
    const originalStretchWidth = stretch.width;
    const adapted = adaptPageToViewport(page, page.width + 200);
    const nextRight = adapted.nodes.find((node) => node.id === right.id)!;
    const nextStretch = adapted.nodes.find((node) => node.id === stretch.id)!;
    expect(adapted.width - (nextRight.x + nextRight.width)).toBe(originalRightMargin);
    expect(nextStretch.width).toBe(originalStretchWidth + 200);
  });
});

describe("design variables", () => {
  it("creates theme and density modes with resolvable values", () => {
    const collections = createSystemVariableCollections(defaultDirection);
    const colors = collections.find((collection) => collection.id === "system.colors")!;
    const spacing = collections.find((collection) => collection.id === "system.spacing")!;
    expect(colors.modes).toEqual(["light", "dark"]);
    expect(resolveVariable(colors, "color.background", "dark")).not.toBe(resolveVariable(colors, "color.background", "light"));
    expect(Number(resolveVariable(spacing, "space.3", "comfortable"))).toBeGreaterThan(Number(resolveVariable(spacing, "space.3", "compact")));
  });
});

describe("components and instances", () => {
  it("creates a reusable definition and independent instance ids", () => {
    const project = planProject("Analytics workspace", defaultDirection, "Atlas");
    const page = project.pages[1];
    const selected = page.nodes.slice(0, 2).map((node) => node.id);
    const component = createComponentDefinition(project, page.id, selected, "Header");
    const first = instantiateComponent(component, 20, 30);
    const second = instantiateComponent(component, 200, 30);
    expect(component.nodes).toHaveLength(2);
    expect(first[0].component?.componentId).toBe(component.id);
    expect(first[0].component?.instanceId).not.toBe(second[0].component?.instanceId);
    expect(first[0].id).not.toBe(second[0].id);
  });
});
