import type { DesignProject } from "./types";

const KEY = "ai-design-canvas.project.v1";
export interface ProjectRepository {
  load(): Promise<DesignProject | null>;
  save(project: DesignProject): Promise<void>;
  clear(): Promise<void>;
}
export class LocalProjectRepository implements ProjectRepository {
  async load() {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as DesignProject : null;
  }
  async save(project: DesignProject) {
    if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(project));
  }
  async clear() {
    if (typeof window !== "undefined") localStorage.removeItem(KEY);
  }
}
