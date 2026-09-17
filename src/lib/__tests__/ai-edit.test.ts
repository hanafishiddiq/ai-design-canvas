import { describe, expect, it } from "vitest";
import { proposalToOperations, type AiEditProposal } from "../ai-edit";
import { defaultDirection } from "../foundations";
import { applyOperation } from "../operations";
import { planProject } from "../planner";

describe("bounded AI edit proposals", () => {
  it("filters edits to explicit selected existing nodes", () => {
    const project = planProject("Analytics", defaultDirection, "Atlas");
    const page = project.pages[1];
    const allowed = page.nodes[0];
    const blocked = page.nodes[1];
    const proposal: AiEditProposal = {
      summary: "Tighten labels", rationale: "Improve hierarchy", warnings: [],
      actions: [
        { action: "update_text", nodeId: allowed.id, kind: null, name: null, text: "Allowed", parentId: null, x: null, y: null, width: null, height: null, background: null, color: null, borderColor: null, radius: null, padding: null, fontSize: null, fontWeight: null, gap: null, layoutMode: null, align: null, widthMode: null, heightMode: null, horizontalConstraint: null, verticalConstraint: null },
        { action: "update_text", nodeId: blocked.id, kind: null, name: null, text: "Blocked", parentId: null, x: null, y: null, width: null, height: null, background: null, color: null, borderColor: null, radius: null, padding: null, fontSize: null, fontWeight: null, gap: null, layoutMode: null, align: null, widthMode: null, heightMode: null, horizontalConstraint: null, verticalConstraint: null },
      ],
    };
    const operations = proposalToOperations(proposal, page, [allowed.id]);
    expect(operations).toHaveLength(1);
    const next = applyOperation(project, { type: "batch", operations }).project;
    expect(next.pages[1].nodes.find((node) => node.id === allowed.id)?.text).toBe("Allowed");
    expect(next.pages[1].nodes.find((node) => node.id === blocked.id)?.text).toBe(blocked.text);
  });
});
