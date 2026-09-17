import { migrateProject, validateProject } from "./schema";
import type { DesignProject } from "./types";

const KEY_V2 = "ai-design-canvas.project.v2";
const LEGACY_KEYS = ["ai-design-canvas.project.v1"];

export interface ProjectRepository {
  load(): Promise<DesignProject | null>;
  save(project: DesignProject): Promise<void>;
  clear(): Promise<void>;
}

export class LocalProjectRepository implements ProjectRepository {
  async load() {
    if (typeof window === "undefined") return null;
    const current = localStorage.getItem(KEY_V2);
    if (current) return migrateProject(JSON.parse(current));

    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const migrated = migrateProject(JSON.parse(raw));
      localStorage.setItem(KEY_V2, JSON.stringify(migrated));
      localStorage.removeItem(key);
      return migrated;
    }
    return null;
  }

  async save(project: DesignProject) {
    if (typeof window === "undefined") return;
    const validation = validateProject(project);
    if (!validation.valid) throw new Error(`Refusing to persist invalid project: ${validation.errors.join(" ")}`);
    localStorage.setItem(KEY_V2, JSON.stringify(project));
  }

  async clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(KEY_V2);
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  }
}
