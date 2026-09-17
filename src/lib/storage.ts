import { migrateProject, validateProject } from "./schema";
import type { DesignProject } from "./types";

const CURRENT_KEY = "ai-design-canvas.project.v5";
const CHECKPOINT_KEY = "ai-design-canvas.checkpoints.v5";
const LEGACY_KEYS = [
  "ai-design-canvas.project.v4",
  "ai-design-canvas.project.v3",
  "ai-design-canvas.project.v2",
  "ai-design-canvas.project.v1",
];
const LEGACY_CHECKPOINT_KEYS = [
  "ai-design-canvas.checkpoints.v4",
  "ai-design-canvas.checkpoints.v3",
  "ai-design-canvas.checkpoints.v2",
];
const MAX_CHECKPOINTS = 20;

export interface ProjectCheckpoint {
  id: string;
  createdAt: string;
  project: DesignProject;
}

export interface ProjectRepository {
  load(): Promise<DesignProject | null>;
  save(project: DesignProject): Promise<void>;
  clear(): Promise<void>;
  listCheckpoints(): Promise<ProjectCheckpoint[]>;
  restoreCheckpoint(id: string): Promise<DesignProject>;
}

function parseCheckpoints(raw: string | null): ProjectCheckpoint[] {
  if (!raw) return [];
  try {
    const values = JSON.parse(raw) as Array<{ id?: string; createdAt?: string; project?: unknown }>;
    if (!Array.isArray(values)) return [];
    return values.flatMap((entry) => {
      try {
        if (!entry.id || !entry.createdAt || !entry.project) return [];
        return [{ id: entry.id, createdAt: entry.createdAt, project: migrateProject(entry.project) }];
      } catch { return []; }
    });
  } catch { return []; }
}

export class LocalProjectRepository implements ProjectRepository {
  async listCheckpoints() {
    if (typeof window === "undefined") return [];
    const current = parseCheckpoints(localStorage.getItem(CHECKPOINT_KEY));
    if (current.length) return current;
    for (const key of LEGACY_CHECKPOINT_KEYS) {
      const migrated = parseCheckpoints(localStorage.getItem(key));
      if (!migrated.length) continue;
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(migrated));
      localStorage.removeItem(key);
      return migrated;
    }
    return [];
  }

  private async writeCheckpoint(project: DesignProject) {
    if (typeof window === "undefined") return;
    const checkpoints = await this.listCheckpoints();
    const latest = checkpoints[0];
    if (latest?.project.updatedAt === project.updatedAt) return;
    checkpoints.unshift({ id: `checkpoint_${Date.now().toString(36)}`, createdAt: new Date().toISOString(), project: structuredClone(project) });
    try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoints.slice(0, MAX_CHECKPOINTS))); }
    catch { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoints.slice(0, 3))); }
  }

  async load() {
    if (typeof window === "undefined") return null;
    const current = localStorage.getItem(CURRENT_KEY);
    if (current) {
      try { return migrateProject(JSON.parse(current)); }
      catch {
        const recovered = (await this.listCheckpoints())[0];
        if (recovered) {
          localStorage.setItem(CURRENT_KEY, JSON.stringify(recovered.project));
          return recovered.project;
        }
      }
    }

    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const migrated = migrateProject(JSON.parse(raw));
        localStorage.setItem(CURRENT_KEY, JSON.stringify(migrated));
        localStorage.removeItem(key);
        return migrated;
      } catch { /* try next legacy source */ }
    }
    const recovered = (await this.listCheckpoints())[0];
    return recovered?.project || null;
  }

  async save(project: DesignProject) {
    if (typeof window === "undefined") return;
    const validation = validateProject(project);
    if (!validation.valid) throw new Error(`Refusing to persist invalid project: ${validation.errors.join(" ")}`);
    const previous = localStorage.getItem(CURRENT_KEY);
    if (previous) {
      try { await this.writeCheckpoint(migrateProject(JSON.parse(previous))); }
      catch { /* malformed previous snapshot must not block valid save */ }
    }
    try { localStorage.setItem(CURRENT_KEY, JSON.stringify(project)); }
    catch (error) {
      throw new Error(`Browser project storage is full. Remove or export large reference images, then retry. ${error instanceof Error ? error.message : ""}`.trim());
    }
  }

  async restoreCheckpoint(id: string) {
    if (typeof window === "undefined") throw new Error("Checkpoint restore is only available in the browser repository.");
    const checkpoint = (await this.listCheckpoints()).find((entry) => entry.id === id);
    if (!checkpoint) throw new Error(`Checkpoint not found: ${id}`);
    const restored = structuredClone(checkpoint.project);
    restored.updatedAt = new Date().toISOString();
    localStorage.setItem(CURRENT_KEY, JSON.stringify(restored));
    return restored;
  }

  async clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CURRENT_KEY);
    localStorage.removeItem(CHECKPOINT_KEY);
    for (const key of [...LEGACY_KEYS, ...LEGACY_CHECKPOINT_KEYS]) localStorage.removeItem(key);
  }
}
