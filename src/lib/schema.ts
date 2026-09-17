import type { DesignProject } from "./types";

export const CURRENT_SCHEMA_VERSION = 3 as const;

export interface ProjectValidationResult {
  valid: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateProject(project: DesignProject): ProjectValidationResult {
  const errors: string[] = [];
  if (project.version !== CURRENT_SCHEMA_VERSION) errors.push(`Expected schema version ${CURRENT_SCHEMA_VERSION}.`);
  if (!project.id) errors.push("Project id is required.");
  if (!project.name.trim()) errors.push("Project name is required.");
  if (!project.pages.length) errors.push("Project must contain at least one page.");
  if (!project.pages.some((page) => page.id === project.activePageId)) errors.push("activePageId must reference an existing page.");
  if (!Array.isArray(project.references)) errors.push("Project references must be an array.");

  const pageIds = new Set<string>();
  const nodeIds = new Set<string>();
  for (const page of project.pages) {
    if (pageIds.has(page.id)) errors.push(`Duplicate page id: ${page.id}`);
    pageIds.add(page.id);
    if (page.width <= 0 || page.height <= 0) errors.push(`Page ${page.id} has invalid dimensions.`);
    for (const node of page.nodes) {
      if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
      nodeIds.add(node.id);
      if (node.width < 0 || node.height < 0) errors.push(`Node ${node.id} has invalid dimensions.`);
      if (node.parentId && !page.nodes.some((candidate) => candidate.id === node.parentId)) errors.push(`Node ${node.id} references missing parent ${node.parentId}.`);
      if (node.children) {
        for (const childId of node.children) {
          if (!page.nodes.some((candidate) => candidate.id === childId)) errors.push(`Node ${node.id} references missing child ${childId}.`);
        }
      }
    }
  }

  for (const flow of project.flows) {
    if (!pageIds.has(flow.fromPageId)) errors.push(`Flow ${flow.id} has missing source page.`);
    if (!pageIds.has(flow.toPageId)) errors.push(`Flow ${flow.id} has missing target page.`);
    if (!nodeIds.has(flow.fromNodeId)) errors.push(`Flow ${flow.id} has missing source node.`);
  }

  const referenceIds = new Set<string>();
  for (const reference of project.references || []) {
    if (referenceIds.has(reference.id)) errors.push(`Duplicate reference id: ${reference.id}`);
    referenceIds.add(reference.id);
    if (!reference.dataUrl.startsWith("data:image/")) errors.push(`Reference ${reference.id} must use an embedded image data URL.`);
    if (reference.analysis.width <= 0 || reference.analysis.height <= 0) errors.push(`Reference ${reference.id} has invalid image dimensions.`);
  }

  return { valid: errors.length === 0, errors };
}

/** Migrate durable project files forward without discarding design state. */
export function migrateProject(raw: unknown): DesignProject {
  if (!isRecord(raw)) throw new Error("Project payload must be an object.");
  const version = typeof raw.version === "number" ? raw.version : 1;
  if (version > CURRENT_SCHEMA_VERSION) throw new Error(`Project schema v${version} is newer than this editor supports.`);

  const migrated = structuredClone(raw) as Record<string, unknown>;
  if (version <= 1) {
    migrated.components = isRecord(migrated.components) ? migrated.components : {};
    migrated.variables = Array.isArray(migrated.variables) ? migrated.variables : [];
    if (Array.isArray(migrated.pages)) {
      migrated.pages = migrated.pages.map((pageValue) => {
        if (!isRecord(pageValue)) return pageValue;
        const page = { ...pageValue };
        if (Array.isArray(page.nodes)) {
          page.nodes = page.nodes.map((nodeValue) => {
            if (!isRecord(nodeValue)) return nodeValue;
            return {
              ...nodeValue,
              layout: isRecord(nodeValue.layout) ? nodeValue.layout : { mode: "absolute" },
              constraints: isRecord(nodeValue.constraints) ? nodeValue.constraints : { horizontal: "left", vertical: "top" },
            };
          });
        }
        return page;
      });
    }
  }
  if (version <= 2) migrated.references = Array.isArray(migrated.references) ? migrated.references : [];
  migrated.version = CURRENT_SCHEMA_VERSION;

  const project = migrated as unknown as DesignProject;
  const validation = validateProject(project);
  if (!validation.valid) throw new Error(`Invalid project: ${validation.errors.join(" ")}`);
  return project;
}
