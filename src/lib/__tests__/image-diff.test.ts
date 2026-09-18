import { describe, expect, it } from "vitest";
import { comparePixelBuffers } from "../image-diff";

describe("pixel visual QA",()=>{
  it("scores identical pixels at 100 and localizes changed pixels",()=>{
    const a=new Uint8ClampedArray([0,0,0,255, 255,255,255,255, 10,10,10,255, 20,20,20,255]);
    const same=comparePixelBuffers({width:2,height:2,data:a},{width:2,height:2,data:new Uint8ClampedArray(a)},.05);
    expect(same.score).toBe(100);expect(same.changedPixels).toBe(0);
    const b=new Uint8ClampedArray(a);b[0]=255;b[1]=0;b[2]=0;
    const changed=comparePixelBuffers({width:2,height:2,data:a},{width:2,height:2,data:b},.05);
    expect(changed.changedPixels).toBe(1);expect(changed.score).toBeLessThan(100);
  });
});
