import { summarizeAudit } from "./anti-slop";
import { exportPageHtml, exportPageReact } from "./export";
import { applyOperation, type DesignOperation } from "./operations";
import { projectToOpenPencilConversion } from "./openpencil-convert";
import { migrateProject, validateProject } from "./schema";
import { serializeProject } from "./serialization";
import type { DesignProject } from "./types";

const projectSchema = { type: "object", description: "AI Design Canvas project JSON. Legacy schema versions are migrated before use." } as const;

export const headlessToolDefinitions = [
  { name: "project_migrate", description: "Migrate an AI Design Canvas project to the current schema and validate it.", inputSchema: { type: "object", additionalProperties: false, properties: { project: projectSchema }, required: ["project"] } },
  { name: "project_validate", description: "Validate and summarize a project without mutating it.", inputSchema: { type: "object", additionalProperties: false, properties: { project: projectSchema }, required: ["project"] } },
  { name: "project_apply_operations", description: "Apply bounded typed DesignOperation objects to a project and return the updated validated project.", inputSchema: { type: "object", additionalProperties: false, properties: { project: projectSchema, operations: { type: "array", maxItems: 200, items: { type: "object" } } }, required: ["project", "operations"] } },
  { name: "project_audit", description: "Run deterministic anti-slop/accessibility/cross-screen checks and return score plus issues.", inputSchema: { type: "object", additionalProperties: false, properties: { project: projectSchema }, required: ["project"] } },
  { name: "page_codegen", description: "Generate semantic React TSX or standalone HTML for one page.", inputSchema: { type: "object", additionalProperties: false, properties: { project: projectSchema, pageId: { type: "string" }, format: { type: "string", enum: ["react", "html"] } }, required: ["project", "pageId", "format"] } },
  { name: "project_openpencil_conversion", description: "Convert the structured project into idempotent OpenPencil code-to-design payloads.", inputSchema: { type: "object", additionalProperties: false, properties: { project: projectSchema }, required: ["project"] } },
  { name: "project_summary", description: "Return compact project metadata for agent orientation.", inputSchema: { type: "object", additionalProperties: false, properties: { project: projectSchema }, required: ["project"] } },
] as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tool arguments must be an object.");
  return value as Record<string, unknown>;
}
function projectArg(args: Record<string, unknown>): DesignProject { return migrateProject(args.project); }

export async function callHeadlessTool(name: string, rawArguments: unknown): Promise<unknown> {
  const args = record(rawArguments);
  if (name === "project_migrate") {
    const project = projectArg(args); return { project, validation: validateProject(project) };
  }
  if (name === "project_validate") {
    const project = projectArg(args); return { validation: validateProject(project), schemaVersion: project.version, bytes: new TextEncoder().encode(serializeProject(project, 0)).length, pages: project.pages.length, nodes: project.pages.reduce((sum, page) => sum + page.nodes.length, 0) };
  }
  if (name === "project_apply_operations") {
    let project = projectArg(args);
    const operations = Array.isArray(args.operations) ? args.operations as DesignOperation[] : [];
    if (operations.length > 200) throw new Error("At most 200 operations may be applied in one request.");
    for (const operation of operations) project = applyOperation(project, operation).project;
    const validation = validateProject(project); if (!validation.valid) throw new Error(`Operations produced invalid project: ${validation.errors.join(" ")}`);
    return { project, validation };
  }
  if (name === "project_audit") return summarizeAudit(projectArg(args));
  if (name === "page_codegen") {
    const project = projectArg(args), pageId = String(args.pageId || ""), format = String(args.format || "react"), page = project.pages.find((item) => item.id === pageId);
    if (!page) throw new Error(`Page not found: ${pageId}`);
    if (format !== "react" && format !== "html") throw new Error("format must be react or html.");
    return { pageId, format, source: format === "react" ? exportPageReact(project, page) : exportPageHtml(project, page) };
  }
  if (name === "project_openpencil_conversion") return projectToOpenPencilConversion(projectArg(args));
  if (name === "project_summary") {
    const project = projectArg(args), audit = summarizeAudit(project);
    return {
      id: project.id,
      name: project.name,
      schemaVersion: project.version,
      updatedAt: project.updatedAt,
      designDirection: project.direction,
      pages: project.pages.map((page) => ({ id: page.id, name: page.name, route: page.route, nodes: page.nodes.length })),
      components: Object.values(project.components).map((component) => ({ id: component.id, name: component.name, nodes: component.nodes.length })),
      variableCollections: project.variables.map((collection) => ({ id: collection.id, modes: collection.modes, variables: collection.variables.length })),
      references: project.references.map((reference) => ({ id: reference.id, name: reference.name, kind: reference.kind })),
      review: { status: project.review.status, openThreads: project.review.threads.filter((thread) => !thread.resolved).length },
      codeMappings: project.codeMappings.length,
      audit: { score: audit.score, errors: audit.errors, warnings: audit.warnings },
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}
