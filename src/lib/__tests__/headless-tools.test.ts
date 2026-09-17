import { describe, expect, it } from "vitest";
import { callHeadlessTool, headlessToolDefinitions } from "../headless-tools";
import { defaultDirection } from "../foundations";
import { planProject } from "../planner";

describe("headless agent tools", () => {
  it("exposes migration, audit, operations, codegen and conversion tools", () => {
    const names = headlessToolDefinitions.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["project_migrate", "project_validate", "project_apply_operations", "project_audit", "page_codegen", "project_openpencil_conversion", "project_summary"]));
  });

  it("applies typed operations statelessly and returns validated project state", async () => {
    const project = planProject("Analytics workspace", defaultDirection, "Atlas");
    const page = project.pages[0];
    const node = page.nodes.find((item) => item.type === "text")!;
    const result = await callHeadlessTool("project_apply_operations", {
      project,
      operations: [{ type: "node.update", pageId: page.id, nodeId: node.id, changes: { text: "Agent changed" } }],
    }) as { project: typeof project; validation: { valid: boolean } };
    expect(result.validation.valid).toBe(true);
    expect(result.project.pages[0].nodes.find((item) => item.id === node.id)?.text).toBe("Agent changed");
  });

  it("generates code and compact summaries without persistence", async () => {
    const project = planProject("Analytics workspace", defaultDirection, "Atlas");
    const summary = await callHeadlessTool("project_summary", { project }) as { pages: unknown[]; audit: { score: number } };
    expect(summary.pages).toHaveLength(project.pages.length);
    expect(summary.audit.score).toBeGreaterThanOrEqual(0);
    const code = await callHeadlessTool("page_codegen", { project, pageId: project.pages[0].id, format: "react" }) as { source: string };
    expect(code.source).toContain("export function");
  });
});
