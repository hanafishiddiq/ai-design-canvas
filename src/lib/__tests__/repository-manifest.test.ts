import { describe, expect, it } from "vitest";
import { applyRepositoryMappingSuggestions, parseRepositoryManifest, suggestRepositoryMappings, tokenDriftReport } from "../repository-manifest";
import { planProject } from "../planner";
import { defaultDirection } from "../foundations";

describe("repository-aware mapping", () => {
  it("maps pages by normalized route and reports token drift", () => {
    const project=planProject("Analytics",defaultDirection,"Atlas");
    project.pages[1].route="/dashboard/:id";
    const manifest=parseRepositoryManifest(JSON.stringify({
      schema:"ai-design-canvas/repository-manifest/v1",generatedAt:new Date(0).toISOString(),rootName:"app",rootFingerprint:"abc",frameworks:["Next.js"],
      files:[{path:"app/dashboard/[id]/page.tsx",hash:"h",bytes:100,language:"tsx"}],
      routes:[{path:"/dashboard/:id",file:"app/dashboard/[id]/page.tsx",source:"filesystem"}],
      components:[],tokens:[{name:"--background",value:"#000000",file:"app.css"}],assets:[],
    }));
    const suggestions=suggestRepositoryMappings(project,manifest);
    expect(suggestions.some((item)=>item.mapping.pageId===project.pages[1].id&&item.confidence>.9)).toBe(true);
    expect(applyRepositoryMappingSuggestions(project,suggestions).codeMappings.length).toBeGreaterThan(0);
    expect(tokenDriftReport(project,manifest).length).toBeGreaterThan(0);
  });
});
