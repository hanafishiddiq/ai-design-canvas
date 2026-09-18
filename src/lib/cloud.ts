import type { DesignProject } from "./types";

export type CloudProjectRole = "owner" | "editor" | "viewer";
export interface CloudUser { id: string; email: string; name: string; createdAt: string }
export interface CloudSession { user: CloudUser; token: string; expiresAt: string }
export interface CloudProjectSummary {
  id: string; name: string; ownerId: string; role: CloudProjectRole; revision: number;
  createdAt: string; updatedAt: string; schemaVersion?: number; members: number;
}
export interface CloudProjectRecord { project: DesignProject; summary: CloudProjectSummary }
export interface CloudMember { user: CloudUser; role: CloudProjectRole }
export interface CloudActivity { id: string; userId: string; userName: string; action: string; detail: string; createdAt: string; revision: number }
export interface CloudHealth { ok: boolean; service: string; registrationAllowed: boolean; users: number; projects: number }

export class CloudConflictError extends Error {
  constructor(public readonly current: CloudProjectSummary) { super("Cloud project has a newer revision. Reload before saving."); }
}

const normalize = (value: string) => value.replace(/\/$/, "");

export class CloudProjectClient {
  constructor(public readonly endpoint: string, public readonly token?: string) {}
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${normalize(this.endpoint)}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}), ...(init.headers || {}) },
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.status === 409 && body.error === "revision_conflict" && body.current) throw new CloudConflictError(body.current as unknown as CloudProjectSummary);
    if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : `Cloud request failed: HTTP ${response.status}`);
    return body as unknown as T;
  }
  health() { return this.request<CloudHealth>("/health", { method: "GET" }); }
  register(name: string, email: string, password: string) { return this.request<CloudSession>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }); }
  login(email: string, password: string) { return this.request<CloudSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); }
  me() { return this.request<{ user: CloudUser }>("/me", { method: "GET" }); }
  async listProjects() { return (await this.request<{ projects: CloudProjectSummary[] }>("/projects", { method: "GET" })).projects; }
  createProject(project: DesignProject) { return this.request<CloudProjectRecord>("/projects", { method: "POST", body: JSON.stringify({ project }) }); }
  getProject(id: string) { return this.request<CloudProjectRecord>(`/projects/${encodeURIComponent(id)}`, { method: "GET" }); }
  saveProject(project: DesignProject, baseRevision: number) { return this.request<CloudProjectRecord>(`/projects/${encodeURIComponent(project.id)}`, { method: "PUT", body: JSON.stringify({ project, baseRevision }) }); }
  deleteProject(id: string) { return this.request<{ ok: boolean }>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  async listMembers(id: string) { return (await this.request<{ members: CloudMember[] }>(`/projects/${encodeURIComponent(id)}/members`, { method: "GET" })).members; }
  addMember(id: string, email: string, role: Extract<CloudProjectRole, "editor" | "viewer">) { return this.request<{ ok: boolean }>(`/projects/${encodeURIComponent(id)}/members`, { method: "POST", body: JSON.stringify({ email, role }) }); }
  removeMember(id: string, userId: string) { return this.request<{ ok: boolean }>(`/projects/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }); }
  async activity(id: string) { return (await this.request<{ activity: CloudActivity[] }>(`/projects/${encodeURIComponent(id)}/activity`, { method: "GET" })).activity; }
}
