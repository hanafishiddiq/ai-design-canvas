import { describe, expect, it } from "vitest";
import { exportDtcgTokens, exportPageSvg } from "../export";
import { defaultDirection } from "../foundations";
import { planProject } from "../planner";

describe("interoperability exports",()=>{
  it("exports DTCG-style token groups and stable SVG ids",()=>{
    const project=planProject("Analytics",defaultDirection,"Atlas");
    const page=project.pages[0];
    const dtcg=JSON.parse(exportDtcgTokens(project)) as Record<string,unknown>;
    expect(dtgcHasColor(dtcg)).toBe(true);
    const svg=exportPageSvg(project,page);
    expect(svg).toContain('data-page-id="'+page.id+'"');
    if(page.nodes[0])expect(svg).toContain('data-node-id="'+page.nodes[0].id+'"');
  });
});
function dtgcHasColor(value:Record<string,unknown>){
  const color=value.color as Record<string,unknown>|undefined;
  return !!color&&color["$type"]==="color";
}
