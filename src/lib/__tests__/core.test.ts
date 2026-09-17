import { describe, expect, it } from "vitest";
import { auditProject, refineProject } from "../anti-slop";
import { mergeTokens, parseDesignMd, serializeDesignMd } from "../design-md";
import { defaultDirection, generateTokens } from "../foundations";
import { planProject } from "../planner";

describe("design foundations", () => {
  it("changes density and radius deterministically", () => {
    const compact = generateTokens(defaultDirection);
    const comfortable = generateTokens({ ...defaultDirection, density: "comfortable", radius: "rounded" });
    expect(comfortable.spacing[3]).toBeGreaterThan(compact.spacing[3]);
    expect(comfortable.radius.md).toBeGreaterThan(compact.radius.md);
  });
});

describe("DESIGN.md bridge", () => {
  it("round-trips direction, tokens and prose", () => {
    const tokens = generateTokens(defaultDirection);
    const source = serializeDesignMd("Test", defaultDirection, tokens, "# Intent\n\nKeep it quiet.");
    const parsed = parseDesignMd(source);
    expect(parsed.direction?.foundation).toBe("linear");
    expect(parsed.tokens?.colors?.background).toBe(tokens.colors.background);
    expect(parsed.prose).toContain("Keep it quiet");
    expect(mergeTokens(tokens, parsed.tokens).colors.accent).toBe(tokens.colors.accent);
  });
});

describe("project planner", () => {
  it("creates a coherent multi-screen CRM flow", () => {
    const project = planProject("A CRM for leads and customer sales", defaultDirection, "Orbit CRM");
    expect(project.pages.length).toBeGreaterThanOrEqual(4);
    expect(project.pages.some((page) => page.name === "Customers")).toBe(true);
    expect(project.flows.length).toBeGreaterThan(0);
    expect(project.designMd).toContain("ai-design-canvas/v1");
  });
});

describe("anti-slop engine", () => {
  it("finds and safely repairs a giant heading and spacing drift", () => {
    const project = planProject("Analytics dashboard", defaultDirection, "Metrics");
    const node = project.pages[0].nodes.find((item) => item.type === "text")!;
    node.style.fontSize = 90;
    node.style.padding = 19;
    const issues = auditProject(project);
    expect(issues.some((item) => item.rule === "giant-heading")).toBe(true);
    expect(issues.some((item) => item.rule === "spacing-drift")).toBe(true);
    const refined = refineProject(project);
    const fixed = refined.project.pages[0].nodes.find((item) => item.id === node.id)!;
    expect(fixed.style.fontSize).toBe(48);
    expect(refined.project.tokens.spacing).toContain(fixed.style.padding);
  });
});
