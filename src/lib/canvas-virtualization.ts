import type { DesignPage } from "./types";

export interface CanvasViewport { width:number; height:number }
export interface WorldBounds { left:number; top:number; right:number; bottom:number }

export function canvasWorldBounds(pan:{x:number;y:number},zoom:number,viewport:CanvasViewport,marginPx=420):WorldBounds{
  const safeZoom=Math.max(.05,zoom);
  const margin=marginPx/safeZoom;
  return {
    left:(-pan.x)/safeZoom-margin,
    top:(-pan.y)/safeZoom-margin,
    right:(viewport.width-pan.x)/safeZoom+margin,
    bottom:(viewport.height-pan.y)/safeZoom+margin,
  };
}
export function pageIntersectsBounds(page:DesignPage,bounds:WorldBounds){
  return page.x+page.width>=bounds.left&&page.x<=bounds.right&&page.y+page.height>=bounds.top&&page.y<=bounds.bottom;
}
export function visibleCanvasPages(pages:DesignPage[],pan:{x:number;y:number},zoom:number,viewport:CanvasViewport,activePageId?:string,minimumBeforeCulling=8){
  if(pages.length<=minimumBeforeCulling)return pages;
  const bounds=canvasWorldBounds(pan,zoom,viewport);
  const visible=pages.filter((page)=>page.id===activePageId||pageIntersectsBounds(page,bounds));
  return visible.length?visible:activePageId?pages.filter((page)=>page.id===activePageId):pages.slice(0,1);
}
