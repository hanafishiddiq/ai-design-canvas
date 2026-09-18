import type { ComponentDefinition, DesignNode, DesignPage, DesignProject, DesignTokens, DesignDirection, VariableCollection } from "./types";

export type ProjectEditableFields = Pick<DesignProject, "name" | "prompt" | "activePageId" | "designMd"> & {
  direction: DesignDirection;
  tokens: DesignTokens;
  variables: VariableCollection[];
};

export type DesignOperation =
  | { type: "project.replace"; project: DesignProject }
  | { type: "project.update"; changes: Partial<ProjectEditableFields> }
  | { type: "page.update"; pageId: string; changes: Partial<Omit<DesignPage, "id" | "nodes">> }
  | { type: "node.update"; pageId: string; nodeId: string; changes: Partial<Omit<DesignNode, "id">> }
  | { type: "node.insert"; pageId: string; node: DesignNode; index?: number }
  | { type: "node.remove"; pageId: string; nodeId: string }
  | { type: "component.upsert"; component: ComponentDefinition }
  | { type: "component.remove"; componentId: string }
  | { type: "batch"; operations: DesignOperation[] };

export interface AppliedOperation {
  project: DesignProject;
  inverse: DesignOperation;
}

export interface OperationTransaction {
  id: string;
  label: string;
  timestamp: string;
  forward: DesignOperation;
  inverse: DesignOperation;
}

const pickPrevious = <T extends object>(source: T, changes: Partial<T>): Partial<T> => {
  const previous: Partial<T> = {};
  for (const key of Object.keys(changes) as Array<keyof T>) previous[key] = structuredClone(source[key]);
  return previous;
};

function findPage(project: DesignProject, pageId: string) {
  const page = project.pages.find((item) => item.id === pageId);
  if (!page) throw new Error(`Page not found: ${pageId}`);
  return page;
}

function findNode(project: DesignProject, pageId: string, nodeId: string) {
  const page = findPage(project, pageId);
  const node = page.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  return { page, node };
}

export function applyOperation(project: DesignProject, operation: DesignOperation): AppliedOperation {
  if (operation.type === "project.replace") {
    const replacement = structuredClone(operation.project);
    replacement.updatedAt = new Date().toISOString();
    return { project: replacement, inverse: { type: "project.replace", project: structuredClone(project) } };
  }

  const next = structuredClone(project);
  let inverse: DesignOperation;

  switch (operation.type) {
    case "project.update": {
      const previous = pickPrevious(next as ProjectEditableFields, operation.changes);
      Object.assign(next, structuredClone(operation.changes));
      inverse = { type: "project.update", changes: previous };
      break;
    }
    case "page.update": {
      const page = findPage(next, operation.pageId);
      const previous = pickPrevious(page, operation.changes);
      Object.assign(page, structuredClone(operation.changes));
      inverse = { type: "page.update", pageId: operation.pageId, changes: previous };
      break;
    }
    case "node.update": {
      const { node } = findNode(next, operation.pageId, operation.nodeId);
      const previous = pickPrevious(node, operation.changes);
      Object.assign(node, structuredClone(operation.changes));
      inverse = { type: "node.update", pageId: operation.pageId, nodeId: operation.nodeId, changes: previous };
      break;
    }
    case "node.insert": {
      const page = findPage(next, operation.pageId);
      if (page.nodes.some((node) => node.id === operation.node.id)) throw new Error(`Node already exists: ${operation.node.id}`);
      const index = Math.max(0, Math.min(operation.index ?? page.nodes.length, page.nodes.length));
      page.nodes.splice(index, 0, structuredClone(operation.node));
      inverse = { type: "node.remove", pageId: operation.pageId, nodeId: operation.node.id };
      break;
    }
    case "node.remove": {
      const page = findPage(next, operation.pageId);
      const index = page.nodes.findIndex((node) => node.id === operation.nodeId);
      if (index < 0) throw new Error(`Node not found: ${operation.nodeId}`);
      const [removed] = page.nodes.splice(index, 1);
      for (const candidate of page.nodes) {
        if (candidate.children?.includes(removed.id)) candidate.children = candidate.children.filter((id) => id !== removed.id);
        if (candidate.parentId === removed.id) delete candidate.parentId;
      }
      next.flows = next.flows.filter((flow) => flow.fromNodeId !== removed.id);
      inverse = { type: "node.insert", pageId: operation.pageId, node: removed, index };
      break;
    }
    case "component.upsert": {
      const previous = next.components[operation.component.id];
      next.components[operation.component.id] = structuredClone(operation.component);
      inverse = previous
        ? { type: "component.upsert", component: previous }
        : { type: "component.remove", componentId: operation.component.id };
      break;
    }
    case "component.remove": {
      const previous = next.components[operation.componentId];
      if (!previous) throw new Error(`Component not found: ${operation.componentId}`);
      delete next.components[operation.componentId];
      inverse = { type: "component.upsert", component: previous };
      break;
    }
    case "batch": {
      let cursor = next;
      const inverses: DesignOperation[] = [];
      for (const child of operation.operations) {
        const applied = applyOperation(cursor, child);
        cursor = applied.project;
        inverses.unshift(applied.inverse);
      }
      cursor.updatedAt = new Date().toISOString();
      return { project: cursor, inverse: { type: "batch", operations: inverses } };
    }
  }

  next.updatedAt = new Date().toISOString();
  return { project: next, inverse };
}

export class OperationHistory {
  private past: OperationTransaction[] = [];
  private future: OperationTransaction[] = [];
  constructor(private project: DesignProject, private limit = 100) {}

  current() { return structuredClone(this.project); }
  canUndo() { return this.past.length > 0; }
  canRedo() { return this.future.length > 0; }
  history() { return this.past.map((entry) => ({ ...entry })); }

  execute(operation: DesignOperation, label: string = operation.type) {
    const applied = applyOperation(this.project, operation);
    const transaction: OperationTransaction = {
      id: `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      label,
      timestamp: new Date().toISOString(),
      forward: structuredClone(operation),
      inverse: structuredClone(applied.inverse),
    };
    this.project = applied.project;
    this.past.push(transaction);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    return this.current();
  }

  /** Apply transient/UI-only state without creating an undo entry. */
  sync(operation: DesignOperation) {
    this.project = applyOperation(this.project, operation).project;
    return this.current();
  }

  undoDetailed(): { project: DesignProject; operation: DesignOperation | null; label: string | null } {
    const transaction = this.past.pop();
    if (!transaction) return { project: this.current(), operation: null, label: null };
    const operation = structuredClone(transaction.inverse);
    const applied = applyOperation(this.project, operation);
    this.project = applied.project;
    this.future.push(transaction);
    return { project: this.current(), operation, label: transaction.label };
  }

  redoDetailed(): { project: DesignProject; operation: DesignOperation | null; label: string | null } {
    const transaction = this.future.pop();
    if (!transaction) return { project: this.current(), operation: null, label: null };
    const operation = structuredClone(transaction.forward);
    const applied = applyOperation(this.project, operation);
    this.project = applied.project;
    this.past.push(transaction);
    return { project: this.current(), operation, label: transaction.label };
  }

  undo() { return this.undoDetailed().project; }

  redo() { return this.redoDetailed().project; }

  reset(project: DesignProject) {
    this.project = structuredClone(project);
    this.past = [];
    this.future = [];
  }
}
