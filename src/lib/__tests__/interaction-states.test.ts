import { describe, expect, it } from "vitest";
import { deriveStateOverride, resolveNodePresentation, setNodeStateOverride } from "../interaction-states";
import { defaultDirection, generateTokens } from "../foundations";
import type { DesignNode } from "../types";

describe("interaction visual states",()=>{
  it("derives and resolves hover/disabled/loading overrides",()=>{
    const node:DesignNode={id:"button",type:"button",name:"Button",text:"Save",x:0,y:0,width:100,height:40,style:{background:"#222222",color:"#ffffff"}};
    const tokens=generateTokens(defaultDirection);
    const loading=deriveStateOverride(node,"loading",tokens);
    const withLoading=setNodeStateOverride(node,"loading",loading);
    expect(resolveNodePresentation(withLoading,"loading").text).toBe("Loading…");
    const disabled=deriveStateOverride(node,"disabled",tokens);
    expect(disabled.style?.opacity).toBeLessThan(1);
  });
});
