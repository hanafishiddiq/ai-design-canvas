import type { ComponentDefinition, DesignNode, DesignProject } from "./types";

let componentCounter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(componentCounter++).toString(36)}`;

function bounds(nodes: DesignNode[]) {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export function createComponentDefinition(project: DesignProject, pageId: string, nodeIds: string[], name: string): ComponentDefinition {
  const page = project.pages.find((item) => item.id === pageId);
  if (!page) throw new Error(`Page not found: ${pageId}`);
  const selected = nodeIds.map((id) => page.nodes.find((node) => node.id === id)).filter((node): node is DesignNode => !!node);
  if (!selected.length) throw new Error("Select at least one node to create a component.");
  const box = bounds(selected);
  const now = new Date().toISOString();
  const componentId = uid("component");
  const templateNodes = selected.map((node) => ({
    ...structuredClone(node),
    x: node.x - box.minX,
    y: node.y - box.minY,
    component: undefined,
  }));
  return { id: componentId, name: name.trim() || "Component", width: box.width, height: box.height, nodes: templateNodes, createdAt: now, updatedAt: now };
}

export function instantiateComponent(component: ComponentDefinition, x: number, y: number): DesignNode[] {
  const instanceId = uid("instance");
  const idMap = new Map(component.nodes.map((node) => [node.id, uid("node")]));
  return component.nodes.map((template) => {
    const id = idMap.get(template.id)!;
    return {
      ...structuredClone(template),
      id,
      x: template.x + x,
      y: template.y + y,
      parentId: template.parentId ? idMap.get(template.parentId) : undefined,
      children: template.children?.map((childId) => idMap.get(childId)).filter((value): value is string => !!value),
      component: {
        componentId: component.id,
        instanceId,
        sourceNodeId: template.id,
        overrides: {},
      },
    };
  });
}

export function detachInstance(nodes: DesignNode[], instanceId: string): DesignNode[] {
  return nodes.map((node) => node.component?.instanceId === instanceId ? { ...structuredClone(node), component: undefined } : structuredClone(node));
}

export function updateInstanceOverride(node: DesignNode, changes: Partial<DesignNode>): DesignNode {
  if (!node.component) return { ...structuredClone(node), ...structuredClone(changes) };
  const next = { ...structuredClone(node), ...structuredClone(changes) };
  next.component = {
    ...node.component,
    overrides: { ...(node.component.overrides || {}), ...structuredClone(changes) },
  };
  return next;
}
