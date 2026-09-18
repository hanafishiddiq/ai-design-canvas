export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export interface PixelDiffRegion { x: number; y: number; width: number; height: number; changedRatio: number }
export interface PixelDiffReport {
  width: number;
  height: number;
  meanDelta: number;
  changedRatio: number;
  score: number;
  changedPixels: number;
  totalPixels: number;
  regions: PixelDiffRegion[];
  dimensionMismatch?: { design: [number, number]; implementation: [number, number] };
  diffDataUrl?: string;
}

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
function perceptualDelta(a: Uint8ClampedArray,b: Uint8ClampedArray,index:number) {
  const dr=Math.abs(a[index]-b[index]);
  const dg=Math.abs(a[index+1]-b[index+1]);
  const db=Math.abs(a[index+2]-b[index+2]);
  const da=Math.abs(a[index+3]-b[index+3]);
  return clamp((0.2126*dr+0.7152*dg+0.0722*db+0.15*da)/255,0,1);
}
function regionsFromTiles(mask: Uint8Array,width:number,height:number,tile=32): PixelDiffRegion[] {
  const cols=Math.ceil(width/tile), rows=Math.ceil(height/tile);
  const active=new Uint8Array(cols*rows);
  const ratios=new Float32Array(cols*rows);
  for(let ty=0;ty<rows;ty++) for(let tx=0;tx<cols;tx++){
    let changed=0,total=0;
    const x0=tx*tile,y0=ty*tile,x1=Math.min(width,x0+tile),y1=Math.min(height,y0+tile);
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){total++;changed+=mask[y*width+x]||0;}
    const ratio=total?changed/total:0; ratios[ty*cols+tx]=ratio; if(ratio>=0.08) active[ty*cols+tx]=1;
  }
  const seen=new Uint8Array(active.length); const regions:PixelDiffRegion[]=[];
  for(let i=0;i<active.length;i++){
    if(!active[i]||seen[i])continue;
    const stack=[i];seen[i]=1;let minX=cols,minY=rows,maxX=0,maxY=0,ratioSum=0,count=0;
    while(stack.length){
      const current=stack.pop()!,x=current%cols,y=Math.floor(current/cols);
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);ratioSum+=ratios[current];count++;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;
        const n=ny*cols+nx;if(active[n]&&!seen[n]){seen[n]=1;stack.push(n);}
      }
    }
    regions.push({x:minX*tile,y:minY*tile,width:Math.min(width,(maxX+1)*tile)-minX*tile,height:Math.min(height,(maxY+1)*tile)-minY*tile,changedRatio:Number((ratioSum/count).toFixed(4))});
  }
  return regions.sort((a,b)=>(b.width*b.height)-(a.width*a.height)).slice(0,12);
}

export function comparePixelBuffers(design:PixelBuffer,implementation:PixelBuffer,threshold=0.08):PixelDiffReport {
  if(design.width!==implementation.width||design.height!==implementation.height) throw new Error("Pixel buffers must have matching dimensions.");
  if(design.data.length!==implementation.data.length) throw new Error("Pixel buffers have different byte lengths.");
  const total=design.width*design.height,mask=new Uint8Array(total);let changed=0,sum=0;
  for(let p=0;p<total;p++){const delta=perceptualDelta(design.data,implementation.data,p*4);sum+=delta;if(delta>=threshold){mask[p]=1;changed++;}}
  const mean=total?sum/total:0,ratio=total?changed/total:0;
  return {width:design.width,height:design.height,meanDelta:Number(mean.toFixed(5)),changedRatio:Number(ratio.toFixed(5)),score:Math.round(clamp(100-(ratio*72+mean*28)*100,0,100)),changedPixels:changed,totalPixels:total,regions:regionsFromTiles(mask,design.width,design.height)};
}

async function loadImage(source:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Could not decode comparison image."));image.src=source;});
}
function imageBuffer(image:HTMLImageElement,width:number,height:number){
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)throw new Error("Canvas 2D is unavailable.");
  context.clearRect(0,0,width,height);context.drawImage(image,0,0,width,height);
  return {canvas,context,data:context.getImageData(0,0,width,height)};
}
export async function compareImageDataUrls(designUrl:string,implementationUrl:string,threshold=0.08,maxDimension=1600):Promise<PixelDiffReport>{
  const [designImage,implementationImage]=await Promise.all([loadImage(designUrl),loadImage(implementationUrl)]);
  const scale=Math.min(1,maxDimension/Math.max(designImage.naturalWidth,designImage.naturalHeight,1));
  const width=Math.max(1,Math.round(designImage.naturalWidth*scale)),height=Math.max(1,Math.round(designImage.naturalHeight*scale));
  const design=imageBuffer(designImage,width,height),implementation=imageBuffer(implementationImage,width,height);
  const report=comparePixelBuffers({width,height,data:design.data.data},{width,height,data:implementation.data.data},threshold);
  if(designImage.naturalWidth!==implementationImage.naturalWidth||designImage.naturalHeight!==implementationImage.naturalHeight) report.dimensionMismatch={design:[designImage.naturalWidth,designImage.naturalHeight],implementation:[implementationImage.naturalWidth,implementationImage.naturalHeight]};
  const diff=document.createElement("canvas");diff.width=width;diff.height=height;const ctx=diff.getContext("2d");if(ctx){
    const output=ctx.createImageData(width,height);
    for(let p=0;p<width*height;p++){const d=perceptualDelta(design.data.data,implementation.data.data,p*4);const i=p*4;output.data[i]=255;output.data[i+1]=Math.round(80*(1-d));output.data[i+2]=Math.round(40*(1-d));output.data[i+3]=d>=threshold?Math.round(70+185*d):20;}
    ctx.putImageData(output,0,0);report.diffDataUrl=diff.toDataURL("image/png");
  }
  return report;
}
