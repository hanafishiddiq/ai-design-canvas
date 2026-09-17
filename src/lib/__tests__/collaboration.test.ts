import { describe, expect, it } from "vitest";
import { applyCollaborationEnvelope, type CollaborationEnvelope } from "../collaboration";
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
