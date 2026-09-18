import { describe, expect, it } from "vitest";
import { applyExtensionFoundation, parseExtensionManifest } from "../extensions";
import { defaultDirection } from "../foundations";
import { planProject } from "../planner";

describe("declarative extensions",()=>{
  it("validates manifests and applies foundation guidance without executable code",()=>{
    const extension=parseExtensionManifest(JSON.stringify({schema:"ai-design-canvas/extension/v1",id:"test.extension",name:"Test",version:"1.0.0",description:"Test extension",foundations:[{id:"warm",name:"Warm",description:"Warm direction",baseFoundation:"attio",direction:{accent:"#aa5533",theme:"light"},guidance:"Use warm neutrals."}],skills:[{id:"refine",name:"Refine",description:"Refine UI",scope:"page",instruction:"Improve hierarchy."}]}));
    const project=planProject("Workspace",defaultDirection,"Atlas");
    const next=applyExtensionFoundation(project,extension,extension.foundations![0]);
    expect(next.direction.foundation).toBe("attio");expect(next.direction.accent).toBe("#aa5533");expect(next.designMd).toContain("Use warm neutrals");
  });
  it("rejects malformed executable-looking manifests that do not satisfy the declarative schema",()=>{
    expect(()=>parseExtensionManifest(JSON.stringify({schema:"ai-design-canvas/extension/v1",id:"x",name:"X",version:"1",description:"x",skills:[{id:"bad",name:"Bad",description:"x",scope:"project",instruction:"x"}]}))).toThrow();
  });
});
