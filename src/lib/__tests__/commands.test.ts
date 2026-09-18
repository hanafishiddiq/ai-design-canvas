import { describe, expect, it } from "vitest";
import { filterCommandItems, projectCommandItems } from "../commands";
import { defaultDirection } from "../foundations";
import { planProject } from "../planner";

describe("command palette index", () => {
  it("indexes screens and nodes and ranks exact page labels", () => {
    const project = planProject("Analytics", defaultDirection, "Atlas");
    const items = projectCommandItems(project);
    expect(items.some((item) => item.kind === "page")).toBe(true);
    expect(items.some((item) => item.kind === "node")).toBe(true);
    const page = project.pages[0];
    const results = filterCommandItems(items, page.name);
    expect(results[0].kind).toBe("page");
    expect(results[0].label).toBe(page.name);
  });
});
