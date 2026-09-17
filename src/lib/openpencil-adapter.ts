import type { DesignPatch, DesignProject } from "./types";

export interface OpenPencilAdapter {
  load(project: DesignProject): Promise<void>;
  save(): Promise<DesignProject>;
  applyPatches(patches: DesignPatch[]): Promise<void>;
  export(format: "json" | "openpencil-bridge"): Promise<string>;
}

export class LocalDesignAdapter implements OpenPencilAdapter {
  private project: DesignProject | null = null;
  async load(project: DesignProject) { this.project = structuredClone(project); }
  async save() {
    if (!this.project) throw new Error("No project loaded");
    return structuredClone(this.project);
  }
  async applyPatches(patches: DesignPatch[]) {
    if (!this.project) throw new Error("No project loaded");
    for (const patch of patches) {
      const page = this.project.pages.find((item) => item.id === patch.pageId);
      if (!page) continue;
      if (!patch.nodeId) Object.assign(page, patch.changes);
      else {
        const node = page.nodes.find((item) => item.id === patch.nodeId);
        if (node) Object.assign(node, patch.changes);
      }
    }
  }
  async export(format: "json" | "openpencil-bridge") {
    if (!this.project) throw new Error("No project loaded");
    return JSON.stringify(format === "json" ? this.project : { schema: "ai-design-canvas/openpencil-bridge/v1", project: this.project }, null, 2);
  }
}

export class HttpOpenPencilAdapter implements OpenPencilAdapter {
  private project: DesignProject | null = null;
  constructor(private endpoint: string, private token?: string) {}
  private async request(path: string, body: unknown) {
    const response = await fetch(`${this.endpoint.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`OpenPencil bridge request failed: ${response.status}`);
    return response.json() as Promise<unknown>;
  }
  async load(project: DesignProject) { this.project = structuredClone(project); await this.request("/load", { project }); }
  async save() {
    if (!this.project) throw new Error("No project loaded");
    const result = await this.request("/save", {}) as { project?: DesignProject };
    return result.project || structuredClone(this.project);
  }
  async applyPatches(patches: DesignPatch[]) { await this.request("/patches", { patches }); }
  async export(format: "json" | "openpencil-bridge") { return JSON.stringify(await this.request("/export", { format }), null, 2); }
}
