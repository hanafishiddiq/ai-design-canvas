import { describe, expect, it } from "vitest";
import { alignNodes, distributeNodes, parseNodeClipboard, remapPastedNodes, serializeNodeClipboard } from "../editor-geometry";
import type { DesignNode } from "../types";

const node=(id:string,x:number,y:number,width=40,height=20,parentId?:string):DesignNode=>({id,type:"card",name:id,x,y,width,height,style:{},...(parentId?{parentId}:{})});

describe("editor geometry",()=>{
  it("aligns and distributes same-parent nodes deterministically",()=>{
    const nodes=[node("a",0,10),node("b",100,30),node("c",220,50)];
    expect(alignNodes(nodes,"top").map((patch)=>patch.y)).toEqual([10,10,10]);
    const distributed=distributeNodes(nodes,"horizontal");
    expect(distributed[0].x).toBe(0);
    expect(distributed[2].x).toBe(220);
    expect(distributed[1].x).toBeGreaterThan(0);
  });
  it("serializes descendants and remaps pasted ids",()=>{
    const parent={...node("parent",10,10,100,100),children:["child"]};
    const child=node("child",5,6,20,20,"parent");
    const payload=parseNodeClipboard(serializeNodeClipboard([parent,child],["parent"]));
    expect(payload.nodes).toHaveLength(2);
    let count=0;
    const pasted=remapPastedNodes(payload.nodes,(prefix)=>prefix+"_"+(++count),20);
    expect(pasted.nodes[0].id).not.toBe("parent");
    expect(pasted.nodes.find((item)=>item.name==="child")?.parentId).toBe(pasted.nodes.find((item)=>item.name==="parent")?.id);
  });
  it("refuses cross-parent alignment",()=>{
    expect(()=>alignNodes([node("a",0,0),node("b",10,10,40,20,"frame")],"left")).toThrow(/same parent/);
  });
});
