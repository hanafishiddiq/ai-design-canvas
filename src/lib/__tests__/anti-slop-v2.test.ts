import { describe, expect, it } from "vitest";
import { auditProject, refineProject, summarizeAudit } from "../anti-slop";
import { defaultDirection } from "../foundations";
import { planProject } from "../planner";

describe("anti-slop v2", () => {
  it("detects accessibility and geometry issues then safely refines deterministic cases", () => {
    const project = planProject("Analytics", defaultDirection, "Atlas");
    const page = project.pages[1];
    const button = page.nodes.find((node) => node.type === "button")!;
    button.width = 20;
    button.height = 20;
    button.x = page.width + 10;
    button.style.color = "#111111";
    button.style.background = "#111111";
    const issues = auditProject(project);
    expect(issues.some((issue) => issue.rule === "small-control-target")).toBe(true);
    expect(issues.some((issue) => issue.rule === "off-canvas")).toBe(true);
    expect(issues.some((issue) => issue.rule === "control-contrast")).toBe(true);
    const refined = refineProject(project).project;
    const next = refined.pages[1].nodes.find((node) => node.id === button.id)!;
    expect(next.width).toBeGreaterThanOrEqual(36);
    expect(next.height).toBeGreaterThanOrEqual(36);
    expect(next.x + next.width).toBeLessThanOrEqual(page.width);
  });

  it("returns an explainable quality summary", () => {
    const project = planProject("Analytics", defaultDirection, "Atlas");
    const summary = summarizeAudit(project);
    expect(summary.score).toBeGreaterThanOrEqual(0);
    expect(summary.score).toBeLessThanOrEqual(100);
    expect(summary.errors + summary.warnings + summary.info).toBe(summary.issues.length);
  });
});
