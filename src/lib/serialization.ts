import { migrateProject, validateProject } from "./schema";
import type { DesignProject } from "./types";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

/** Stable key ordering makes Git diffs deterministic without reordering semantic arrays. */
export function serializeProject(project: DesignProject, space = 2): string {
  const validation = validateProject(project);
  if (!validation.valid) throw new Error(`Cannot serialize invalid project: ${validation.errors.join(" ")}`);
  return JSON.stringify(sortValue(project), null, space);
}

export function parseProject(source: string): DesignProject {
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch (error) { throw new Error(`Invalid project JSON: ${error instanceof Error ? error.message : String(error)}`); }
  return migrateProject(parsed);
}

export async function projectFingerprint(project: DesignProject): Promise<string> {
  const bytes = new TextEncoder().encode(serializeProject(project, 0));
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
