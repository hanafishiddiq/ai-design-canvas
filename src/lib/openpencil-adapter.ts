import { applyOperation, type DesignOperation } from "./operations";
import { migrateProject } from "./schema";
import type { DesignPatch, DesignProject } from "./types";

export interface DesignEngineCapabilities {
  operations: boolean;
  patches: boolean;
  render: boolean;
  screenshots: boolean;
  import: string[];
  export: string[];
  components: boolean;
  variables: boolean;
  autoLayout: boolean;
}

export interface DesignEngineAdapter {
  capabilities(): Promise<DesignEngineCapabilities>;
  load(project: DesignProject): Promise<void>;
  save(): Promise<DesignProject>;
  applyOperations(operations: DesignOperation[]): Promise<void>;
  applyPatches(patches: DesignPatch[]): Promise<void>;
  export(format: "json" | "openpencil-bridge"): Promise<string>;
}

/** Backward-compatible name while downstream integrations move to DesignEngineAdapter. */
export type OpenPencilAdapter = DesignEngineAdapter;

export class LocalDesignAdapter implements DesignEngineAdapter {
  private project: DesignProject | null = null;

  async capabilities(): Promise<DesignEngineCapabilities> {
    return {
      operations: true,
      patches: true,
      render: false,
      screenshots: false,
      import: ["json"],
      export: ["json", "openpencil-bridge"],
      components: true,
      variables: true,
      autoLayout: true,
    };
  }

  async load(project: DesignProject) { this.project = migrateProject(project); }

  async save() {
    if (!this.project) throw new Error("No project loaded");
    return structuredClone(this.project);
  }

  async applyOperations(operations: DesignOperation[]) {
    if (!this.project) throw new Error("No project loaded");
    let next = this.project;
    for (const operation of operations) next = applyOperation(next, operation).project;
    this.project = next;
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
    return JSON.stringify(
      format === "json"
        ? this.project
        : { schema: "ai-design-canvas/openpencil-bridge/v2", project: this.project },
      null,
      2,
    );
  }
}

export class HttpOpenPencilAdapter implements DesignEngineAdapter {
  private project: DesignProject | null = null;
  constructor(private endpoint: string, private token?: string) {}

  private async request(path: string, body: unknown) {
    const response = await fetch(`${this.endpoint.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Design engine request failed: ${response.status}`);
    return response.json() as Promise<unknown>;
  }

  async capabilities() {
    try {
      return await this.request("/capabilities", {}) as DesignEngineCapabilities;
    } catch {
      return {
        operations: false,
        patches: true,
        render: false,
        screenshots: false,
        import: [],
        export: ["json", "openpencil-bridge"],
        components: false,
        variables: false,
        autoLayout: false,
      };
    }
  }

  async load(project: DesignProject) {
    this.project = migrateProject(project);
    await this.request("/load", { project: this.project });
  }

  async save() {
    if (!this.project) throw new Error("No project loaded");
    const result = await this.request("/save", {}) as { project?: DesignProject };
    return result.project ? migrateProject(result.project) : structuredClone(this.project);
  }

  async applyOperations(operations: DesignOperation[]) {
    await this.request("/operations", { operations });
    if (this.project) {
      let next = this.project;
      for (const operation of operations) next = applyOperation(next, operation).project;
      this.project = next;
    }
  }

  async applyPatches(patches: DesignPatch[]) { await this.request("/patches", { patches }); }
  async export(format: "json" | "openpencil-bridge") { return JSON.stringify(await this.request("/export", { format }), null, 2); }
}
