import type { DesignOperation } from "./operations";
import type { DesignProject } from "./types";
import type { CollaborationEnvelope, CollaborationHandlers, CollaborationTransport, CollaboratorPresence } from "./collaboration";

const normalize = (value: string) => value.replace(/\/$/, "");

export class HttpSseCollaborationTransport implements CollaborationTransport {
  readonly clientId: string;
  private sequence = 0;
  private events: EventSource | null = null;

  constructor(
    public readonly roomId: string,
    private readonly projectId: string,
    private readonly endpoint: string,
    private readonly token?: string,
    clientId?: string,
  ) {
    this.clientId = clientId || `client_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async post(path: string, body: unknown) {
    const response = await fetch(`${normalize(this.endpoint)}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Collaboration relay ${path} failed: HTTP ${response.status}`);
    return response.json().catch(() => ({}));
  }

  connect(handlers: CollaborationHandlers) {
    if (typeof EventSource === "undefined") {
      handlers.onError?.(new Error("EventSource is unavailable in this environment."));
      return () => {};
    }
    const params = new URLSearchParams({ roomId: this.roomId, projectId: this.projectId, clientId: this.clientId });
    if (this.token) params.set("token", this.token);
    const events = new EventSource(`${normalize(this.endpoint)}/events?${params}`);
    this.events = events;
    events.addEventListener("operations", (event) => {
      try { handlers.onOperations?.(JSON.parse((event as MessageEvent).data) as CollaborationEnvelope); }
      catch (error) { handlers.onError?.(error instanceof Error ? error : new Error(String(error))); }
    });
    events.addEventListener("presence", (event) => {
      try { handlers.onPresence?.(JSON.parse((event as MessageEvent).data) as CollaboratorPresence[]); }
      catch (error) { handlers.onError?.(error instanceof Error ? error : new Error(String(error))); }
    });
    events.onerror = () => handlers.onError?.(new Error("Collaboration relay event stream disconnected."));
    return () => { events.close(); if (this.events === events) this.events = null; };
  }

  publishOperations(project: DesignProject, operations: DesignOperation[]) {
    if (!operations.length) return;
    const envelope: CollaborationEnvelope = {
      id: `collab_${Date.now().toString(36)}_${this.sequence.toString(36)}`,
      roomId: this.roomId,
      projectId: this.projectId,
      clientId: this.clientId,
      sequence: this.sequence++,
      baseUpdatedAt: project.updatedAt,
      createdAt: new Date().toISOString(),
      operations: structuredClone(operations),
    };
    void this.post("/operations", envelope);
  }

  updatePresence(presence: Omit<CollaboratorPresence, "clientId" | "lastSeenAt">) {
    void this.post("/presence", { roomId: this.roomId, projectId: this.projectId, clientId: this.clientId, presence: { ...presence, clientId: this.clientId, lastSeenAt: new Date().toISOString() } });
  }

  async publishSnapshot(project: DesignProject) {
    await this.post("/snapshot", { roomId: this.roomId, projectId: this.projectId, clientId: this.clientId, project });
  }

  async fetchSnapshot(): Promise<DesignProject | null> {
    const params = new URLSearchParams({ roomId: this.roomId, projectId: this.projectId });
    if (this.token) params.set("token", this.token);
    const response = await fetch(`${normalize(this.endpoint)}/snapshot?${params}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Collaboration snapshot failed: HTTP ${response.status}`);
    const body = await response.json() as { project?: DesignProject };
    return body.project || null;
  }
}
