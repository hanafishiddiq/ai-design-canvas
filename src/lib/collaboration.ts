import { applyOperation, type DesignOperation } from "./operations";
import { validateProject } from "./schema";
import type { DesignProject } from "./types";

export interface CollaboratorPresence {
  clientId: string;
  name: string;
  pageId?: string;
  nodeIds?: string[];
  lastSeenAt: string;
}

export interface CollaborationEnvelope {
  id: string;
  roomId: string;
  projectId: string;
  clientId: string;
  sequence: number;
  baseUpdatedAt: string;
  createdAt: string;
  operations: DesignOperation[];
}

export interface CollaborationHandlers {
  onOperations?: (envelope: CollaborationEnvelope) => void;
  onPresence?: (peers: CollaboratorPresence[]) => void;
  onError?: (error: Error) => void;
}

export interface CollaborationTransport {
  readonly roomId: string;
  readonly clientId: string;
  connect(handlers: CollaborationHandlers): () => void;
  publishOperations(project: DesignProject, operations: DesignOperation[]): void;
  updatePresence(presence: Omit<CollaboratorPresence, "clientId" | "lastSeenAt">): void;
}

export function applyCollaborationEnvelope(project: DesignProject, envelope: CollaborationEnvelope): DesignProject {
  if (envelope.projectId !== project.id) throw new Error(`Envelope project ${envelope.projectId} does not match ${project.id}.`);
  if (envelope.operations.length > 200) throw new Error("Collaboration envelope exceeds the 200-operation safety limit.");
  if (envelope.baseUpdatedAt !== project.updatedAt && envelope.operations.some((operation) => operation.type === "project.replace")) {
    throw new Error("Stale destructive collaboration update rejected. Refresh from the latest snapshot before replacing the whole project.");
  }
  let next = structuredClone(project);
  for (const operation of envelope.operations) next = applyOperation(next, operation).project;
  const validation = validateProject(next);
  if (!validation.valid) throw new Error(`Collaborative operations produced invalid project: ${validation.errors.join(" ")}`);
  return next;
}

/** Dedupe and monotonic-sequence guard for reconnects/replayed SSE events. */
export class CollaborationEventTracker {
  private seen = new Set<string>();
  private lastSequence = new Map<string, number>();

  accept(envelope: CollaborationEnvelope) {
    if (this.seen.has(envelope.id)) return false;
    const previous = this.lastSequence.get(envelope.clientId);
    if (previous !== undefined && envelope.sequence <= previous) return false;
    this.seen.add(envelope.id);
    this.lastSequence.set(envelope.clientId, envelope.sequence);
    if (this.seen.size > 2000) {
      const oldest = this.seen.values().next().value as string | undefined;
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }

  reset() {
    this.seen.clear();
    this.lastSequence.clear();
  }
}

/**
 * Real local collaboration transport. It works across tabs/windows from the
 * same browser profile. Cloud transports should implement the same interface.
 */
export class BroadcastCollaborationTransport implements CollaborationTransport {
  readonly clientId: string;
  private channel: BroadcastChannel | null = null;
  private handlers: CollaborationHandlers = {};
  private sequence = 0;
  private peers = new Map<string, CollaboratorPresence>();
  private presence: Omit<CollaboratorPresence, "clientId" | "lastSeenAt"> = { name: "Designer" };
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(public readonly roomId: string, private readonly projectId: string, clientId?: string) {
    this.clientId = clientId || `client_${Math.random().toString(36).slice(2, 10)}`;
  }

  private emitPresence() {
    this.handlers.onPresence?.([...this.peers.values()].sort((a, b) => a.name.localeCompare(b.name)));
  }

  private announce(kind: "presence" | "leave" = "presence") {
    if (!this.channel) return;
    this.channel.postMessage({ kind, roomId: this.roomId, projectId: this.projectId, clientId: this.clientId, presence: { ...this.presence, clientId: this.clientId, lastSeenAt: new Date().toISOString() } });
  }

  connect(handlers: CollaborationHandlers) {
    this.handlers = handlers;
    if (typeof BroadcastChannel === "undefined") {
      handlers.onError?.(new Error("BroadcastChannel is unavailable in this environment."));
      return () => {};
    }
    this.channel = new BroadcastChannel(`ai-design-canvas.collab.${this.roomId}`);
    const onMessage = (event: MessageEvent<Record<string, unknown>>) => {
      const data = event.data;
      if (!data || data.clientId === this.clientId || data.projectId !== this.projectId) return;
      if (data.kind === "operations") {
        try { handlers.onOperations?.(data.envelope as unknown as CollaborationEnvelope); }
        catch (error) { handlers.onError?.(error instanceof Error ? error : new Error(String(error))); }
        return;
      }
      const clientId = String(data.clientId || "");
      if (!clientId) return;
      if (data.kind === "leave") this.peers.delete(clientId);
      else if (data.kind === "presence" && data.presence && typeof data.presence === "object") this.peers.set(clientId, data.presence as unknown as CollaboratorPresence);
      this.emitPresence();
    };
    this.channel.addEventListener("message", onMessage);
    this.announce();
    this.heartbeat = setInterval(() => this.announce(), 10_000);
    return () => {
      this.announce("leave");
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      this.channel?.removeEventListener("message", onMessage);
      this.channel?.close();
      this.channel = null;
      this.peers.clear();
    };
  }

  publishOperations(project: DesignProject, operations: DesignOperation[]) {
    if (!operations.length || !this.channel) return;
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
    this.channel.postMessage({ kind: "operations", projectId: this.projectId, clientId: this.clientId, envelope });
  }

  updatePresence(presence: Omit<CollaboratorPresence, "clientId" | "lastSeenAt">) {
    this.presence = { ...presence };
    this.announce();
  }
}
