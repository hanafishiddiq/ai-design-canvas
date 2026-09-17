import { migrateProject, validateProject } from "./schema";
import { projectFingerprint, serializeProject } from "./serialization";
import type { DesignProject } from "./types";

export const PROJECT_BUNDLE_FORMAT = "ai-design-canvas/bundle" as const;
export const PROJECT_BUNDLE_VERSION = 1 as const;

export interface ProjectBundleManifest {
  format: typeof PROJECT_BUNDLE_FORMAT;
  bundleVersion: typeof PROJECT_BUNDLE_VERSION;
  projectSchemaVersion: number;
  projectId: string;
  name: string;
  exportedAt: string;
  fingerprint: string;
  pages: number;
  nodes: number;
  components: number;
  references: number;
  reviewThreads: number;
  codeMappings: number;
}

export interface ProjectBundle {
  manifest: ProjectBundleManifest;
  project: DesignProject;
  files: {
    "DESIGN.md": string;
  };
}

export async function createProjectBundle(project: DesignProject): Promise<ProjectBundle> {
  const validation = validateProject(project);
  if (!validation.valid) throw new Error(`Cannot bundle invalid project: ${validation.errors.join(" ")}`);
  const stable = JSON.parse(serializeProject(project)) as DesignProject;
  return {
    manifest: {
      format: PROJECT_BUNDLE_FORMAT,
      bundleVersion: PROJECT_BUNDLE_VERSION,
      projectSchemaVersion: project.version,
      projectId: project.id,
      name: project.name,
      exportedAt: new Date().toISOString(),
      fingerprint: await projectFingerprint(project),
      pages: project.pages.length,
      nodes: project.pages.reduce((sum, page) => sum + page.nodes.length, 0),
      components: Object.keys(project.components).length,
      references: project.references.length,
      reviewThreads: project.review.threads.length,
      codeMappings: project.codeMappings.length,
    },
    project: stable,
    files: { "DESIGN.md": project.designMd },
  };
}

export function serializeProjectBundle(bundle: ProjectBundle, space = 2) {
  return JSON.stringify(bundle, null, space);
}

export function parseProjectBundle(source: string): ProjectBundle {
  let raw: unknown;
  try { raw = JSON.parse(source); }
  catch (error) { throw new Error(`Invalid AI Design Canvas bundle JSON: ${error instanceof Error ? error.message : String(error)}`); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Bundle root must be an object.");
  const value = raw as Record<string, unknown>;
  const manifest = value.manifest as Record<string, unknown> | undefined;
  if (!manifest || manifest.format !== PROJECT_BUNDLE_FORMAT) throw new Error("Unsupported project bundle format.");
  if (manifest.bundleVersion !== PROJECT_BUNDLE_VERSION) throw new Error(`Unsupported bundle version: ${String(manifest.bundleVersion)}`);
  const project = migrateProject(value.project);
  return {
    manifest: {
      format: PROJECT_BUNDLE_FORMAT,
      bundleVersion: PROJECT_BUNDLE_VERSION,
      projectSchemaVersion: project.version,
      projectId: project.id,
      name: project.name,
      exportedAt: String(manifest.exportedAt || new Date(0).toISOString()),
      fingerprint: String(manifest.fingerprint || ""),
      pages: project.pages.length,
      nodes: project.pages.reduce((sum, page) => sum + page.nodes.length, 0),
      components: Object.keys(project.components).length,
      references: project.references.length,
      reviewThreads: project.review.threads.length,
      codeMappings: project.codeMappings.length,
    },
    project,
    files: { "DESIGN.md": project.designMd },
  };
}

export async function verifyProjectBundle(bundle: ProjectBundle) {
  const actual = await projectFingerprint(bundle.project);
  return { valid: !!bundle.manifest.fingerprint && actual === bundle.manifest.fingerprint, expected: bundle.manifest.fingerprint, actual };
}
