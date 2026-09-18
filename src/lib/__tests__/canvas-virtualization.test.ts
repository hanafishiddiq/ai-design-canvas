import { describe, expect, it } from "vitest";
import { canvasWorldBounds, visibleCanvasPages } from "../canvas-virtualization";
import type { DesignPage } from "../types";

const page=(id:string,x:number):DesignPage=>({id,name:id,route:`/${id}`,x,y:0,width:300,height:200,background:"#000",nodes:[]});
describe("canvas virtualization",()=>{
  it("computes world viewport from pan/zoom and keeps active pages mounted",()=>{
    const bounds=canvasWorldBounds({x:0,y:0},1,{width:800,height:600},0);
    expect(bounds).toEqual({left:0,top:0,right:800,bottom:600});
    const pages=Array.from({length:12},(_,index)=>page(`p${index}`,index*500));
    const visible=visibleCanvasPages(pages,{x:0,y:0},1,{width:800,height:600},"p10",4);
    expect(visible.some((item)=>item.id==="p0")).toBe(true);
    expect(visible.some((item)=>item.id==="p10")).toBe(true);
    expect(visible.length).toBeLessThan(pages.length);
  });
});
