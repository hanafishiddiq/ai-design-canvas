import { describe, expect, it } from "vitest";
import { applyCollaborationEnvelope, CollaborationEventTracker, type CollaborationEnvelope } from "../collaboration";
import { defaultDirection } from "../foundations";
import { planProject } from "../planner";

describe("collaboration protocol", () => {
  it("applies bounded remote operations and preserves schema validity", () => {
    const project = planProject("Analytics workspace", defaultDirection, "Atlas");
    const page = project.pages[0];
    const node = page.nodes[0];
    const envelope: CollaborationEnvelope = {
      id: "evt-1",
      roomId: "room-1",
      projectId: project.id,
      clientId: "peer-1",
      sequence: 1,
      baseUpdatedAt: project.updatedAt,
      createdAt: new Date().toISOString(),
      operations: [{ type: "node.update", pageId: page.id, nodeId: node.id, changes: { text: "Remote edit" } }],
    };
    const next = applyCollaborationEnvelope(project, envelope);
    expect(next.version).toBe(5);
    expect(next.pages[0].nodes[0].text).toBe("Remote edit");
  });

  it("rejects operations for another project", () => {
    const project = planProject("Workspace", defaultDirection, "Atlas");
    expect(() => applyCollaborationEnvelope(project, {
      id: "evt-2", roomId: "room-1", projectId: "other", clientId: "peer", sequence: 1,
      baseUpdatedAt: project.updatedAt, createdAt: new Date().toISOString(), operations: [],
    })).toThrow(/does not match/);
  });
});


describe("collaboration replay safety", () => {
  it("deduplicates and rejects out-of-order events per client", () => {
    const tracker = new CollaborationEventTracker();
    const base = { id: "evt-a", roomId: "room", projectId: "project", clientId: "peer", sequence: 2, baseUpdatedAt: "t0", createdAt: "t1", operations: [] } satisfies CollaborationEnvelope;
    expect(tracker.accept(base)).toBe(true);
    expect(tracker.accept(base)).toBe(false);
    expect(tracker.accept({ ...base, id: "evt-old", sequence: 1 })).toBe(false);
    expect(tracker.accept({ ...base, id: "evt-new", sequence: 3 })).toBe(true);
  });

  it("rejects stale whole-project replacement but permits bounded stale patches", () => {
    const project = planProject("Workspace", defaultDirection, "Atlas");
    const page = project.pages[0];
    const node = page.nodes[0];
    expect(() => applyCollaborationEnvelope(project, {
      id: "replace", roomId: "room", projectId: project.id, clientId: "peer", sequence: 1,
      baseUpdatedAt: "stale", createdAt: "now", operations: [{ type: "project.replace", project }],
    })).toThrow(/Stale destructive/);
    const next = applyCollaborationEnvelope(project, {
      id: "patch", roomId: "room", projectId: project.id, clientId: "peer", sequence: 2,
      baseUpdatedAt: "stale", createdAt: "now", operations: [{ type: "node.update", pageId: page.id, nodeId: node.id, changes: { text: "Merged patch" } }],
    });
    expect(next.pages[0].nodes[0].text).toBe("Merged patch");
  });
});
