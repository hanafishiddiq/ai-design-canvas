import { describe, expect, it } from "vitest";
import { mergeOpenPencilPull, openPencilVariablesToCollections, penRootsToPages, type OpenPencilLoss } from "../openpencil-pull";
import { defaultDirection } from "../foundations";
import { planProject } from "../planner";

describe("OpenPencil loss-aware pull", () => {
  it("converts screen frames and preserves semantic hierarchy", () => {
    const losses: OpenPencilLoss[] = [];
    const pages = penRootsToPages({ id: "p1", name: "Page 1" }, [{
      type: "frame", id: "screen", name: "Dashboard", screen: "/dashboard", width: 720, height: 460,
      fill: [{ type: "solid", color: "#101010" }],
      children: [
        { type: "text", id: "title", name: "Title", x: 24, y: 24, width: 200, height: 32, content: "Dashboard", fontSize: 28, fill: [{ type: "solid", color: "#ffffff" }] },
        { type: "frame", id: "stack", name: "Stack", x: 24, y: 80, width: 400, height: 160, layout: "vertical", gap: 12, padding: 16, children: [
          { type: "text_input", id: "search", name: "Search", width: "fill_container", height: 40, label: "Search" },
        ] },
      ],
    }], "#000000", losses);
    expect(pages).toHaveLength(1);
    expect(pages[0].route).toBe("/dashboard");
    expect(pages[0].nodes.find((node) => node.id === "search")?.parentId).toBe("stack");
    expect(pages[0].nodes.find((node) => node.id === "search")?.layout?.widthMode).toBe("fill");
  });

  it("imports scalar variables and merges a pulled candidate without invalid flows", () => {
    const losses: OpenPencilLoss[] = [];
    const collections = openPencilVariablesToCollections({
      "colors/brand": { type: "color", value: "#ff3366" },
      "spacing/md": { type: "number", value: 16 },
    }, { Mode: ["Light", "Dark"] }, losses);
    expect(collections.reduce((sum, collection) => sum + collection.variables.length, 0)).toBe(2);
    const base = planProject("Analytics", defaultDirection, "Atlas");
    const pages = penRootsToPages({ id: "p1", name: "Imported" }, [{
      type: "frame", id: base.pages[0].id, name: "Imported", screen: "/login", width: 720, height: 460, children: [],
    }], base.tokens.colors.background, losses);
    const result = mergeOpenPencilPull(base, pages, [], collections, undefined, losses, []);
    expect(result.project.version).toBe(5);
    expect(result.project.pages).toHaveLength(1);
    expect(result.report.variables).toBe(2);
  });
});
