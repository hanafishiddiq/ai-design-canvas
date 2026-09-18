"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Download, ImagePlus, ScanSearch, Upload, X } from "lucide-react";
import { proposalToOperations } from "@/lib/ai-edit";
import { applyOperation } from "@/lib/operations";
import { compareImageDataUrls, type PixelDiffReport } from "@/lib/image-diff";
import { downloadText } from "@/lib/export";
import { LocalProjectRepository } from "@/lib/storage";
import type { VisualQaAiResult } from "@/lib/visual-qa-ai";

const readDataUrl=(file:File)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file);});

export function PixelQaPanel(){
  const repository=useMemo(()=>new LocalProjectRepository(),[]);
  const designRef=useRef<HTMLInputElement>(null),implRef=useRef<HTMLInputElement>(null);
  const [open,setOpen]=useState(false),[design,setDesign]=useState(""),[implementation,setImplementation]=useState("");
  const [report,setReport]=useState<PixelDiffReport|null>(null),[ai,setAi]=useState<VisualQaAiResult|null>(null);
  const [threshold,setThreshold]=useState(.08),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const load=async(file:File|undefined,setter:(value:string)=>void)=>{if(!file)return;setter(await readDataUrl(file));setReport(null);setAi(null);};
  const compare=async()=>{if(!design||!implementation)return;setBusy(true);setMessage("");try{setReport(await compareImageDataUrls(design,implementation,threshold));}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}};
  const critique=async()=>{
    if(!design||!implementation||!report)return;setBusy(true);setMessage("");
    try{
      const project=await repository.load();if(!project)throw new Error("No project loaded.");
      const page=project.pages.find((item)=>item.id===project.activePageId)||project.pages[0];if(!page)throw new Error("No active page.");
      const response=await fetch("/api/ai/visual-qa",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({designImage:design,implementationImage:implementation,page,designMd:project.designMd,localReport:{score:report.score,meanDelta:report.meanDelta,changedRatio:report.changedRatio,regions:report.regions,dimensionMismatch:report.dimensionMismatch||null}})});
      const body=await response.json() as {result?:VisualQaAiResult;error?:string};if(!response.ok||!body.result)throw new Error(body.error||"AI critique failed.");setAi(body.result);
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  };
  const apply=async()=>{
    if(!ai)return;const project=await repository.load();if(!project)return;
    const page=project.pages.find((item)=>item.id===project.activePageId)||project.pages[0];if(!page)return;
    const operations=proposalToOperations(ai.proposal,page,[]);
    if(typeof window!=="undefined"&&!window.confirm(`Apply ${operations.length} bounded AI QA operation(s) to the active design? Undo remains available in Studio.`))return;
    let next=project;for(const operation of operations)next=applyOperation(next,operation).project;await repository.save(next);window.location.reload();
  };
  if(!open)return <button className="fixed bottom-24 right-4 z-[88] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={()=>setOpen(true)}><ScanSearch size={13}/> Pixel QA</button>;
  return <div className="fixed inset-0 z-[87] grid place-items-center bg-black/70 p-6 backdrop-blur-sm"><div className="flex h-[min(820px,calc(100vh-3rem))] w-[min(1180px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
    <div className="flex h-12 items-center gap-2 border-b border-[#292e36] px-3"><ScanSearch size={14} className="text-[#8d99ff]"/><div className="flex-1"><div className="text-[12px] font-semibold">Screenshot / pixel visual QA</div><div className="text-[9px] text-[#6e7784]">Local deterministic diff first; optional AI critique only on explicit request.</div></div><button className="tool-button" onClick={()=>setOpen(false)}><X size={12}/></button></div>
    {message&&<div className="border-b border-[#4b292e] bg-[#211215] px-4 py-2 text-[10px] text-[#e78c96]">{message}</div>}
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr_330px]">
      {[["Approved design",design,designRef,(v:string)=>setDesign(v)],["Implementation",implementation,implRef,(v:string)=>setImplementation(v)]].map(([label,src,ref,setter])=><section key={label as string} className="flex min-h-0 flex-col border-r border-[#242830] p-3"><div className="flex items-center justify-between"><div className="panel-label !mb-0">{label as string}</div><button className="tool-button" onClick={()=>((ref as React.RefObject<HTMLInputElement|null>).current?.click())}><Upload size={11}/> Image</button></div><input ref={ref as React.RefObject<HTMLInputElement>} className="hidden" type="file" accept="image/*" onChange={(event)=>void load(event.target.files?.[0],setter as (v:string)=>void)}/><div className="mt-3 grid min-h-0 flex-1 place-items-center overflow-hidden rounded-lg border border-[#292e36] bg-[#080a0d]">{src?<Image src={src as string} alt={label as string} width={1000} height={800} unoptimized className="max-h-full max-w-full object-contain"/>:<ImagePlus size={28} className="text-[#4e5764]"/>}</div></section>)}
      <aside className="min-h-0 overflow-auto p-3"><div className="panel-label">Local comparison</div><label className="text-[9px] text-[#6f7784]">Pixel threshold {Math.round(threshold*100)}%<input className="mt-2 w-full" type="range" min=".02" max=".25" step=".01" value={threshold} onChange={(event)=>setThreshold(Number(event.target.value))}/></label><button className="tool-button primary mt-3 w-full" disabled={!design||!implementation||busy} onClick={()=>void compare()}><ScanSearch size={11}/> Compare locally</button>
        {report&&<div className="mt-4"><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-[#294334] bg-[#101a15] p-3"><div className="text-[22px] font-semibold text-[#7bd39f]">{report.score}</div><div className="text-[8px] uppercase text-[#688a76]">score</div></div><div className="rounded-lg border border-[#292e36] p-3"><div className="text-[17px] font-semibold">{(report.changedRatio*100).toFixed(1)}%</div><div className="text-[8px] uppercase text-[#68717d]">changed pixels</div></div></div>{report.dimensionMismatch&&<div className="mt-2 rounded border border-[#4a4027] p-2 text-[9px] text-[#c7b98e]">Dimension mismatch: {report.dimensionMismatch.design.join("×")} vs {report.dimensionMismatch.implementation.join("×")}. Implementation was scaled only for comparison.</div>}{report.diffDataUrl&&<Image src={report.diffDataUrl} alt="Pixel difference" width={report.width} height={report.height} unoptimized className="mt-3 w-full rounded border border-[#292e36]"/>}<div className="mt-3 text-[9px] text-[#68717d]">{report.regions.length} changed region(s) · mean Δ {(report.meanDelta*100).toFixed(2)}%</div><button className="tool-button mt-3 w-full" onClick={()=>downloadText("visual-qa-report.json",JSON.stringify({...report,diffDataUrl:undefined},null,2),"application/json")}><Download size={11}/> Report JSON</button><button className="tool-button primary mt-2 w-full" disabled={busy} onClick={()=>void critique()}><Bot size={11}/> AI critique + fix proposal</button></div>}
        {ai&&<div className="mt-4 rounded-lg border border-[#29334b] bg-[#111725] p-3 text-[9px] leading-4 text-[#aeb8d5]"><div className="font-semibold text-[#d1d7ef]">{ai.summary}</div><div className="mt-2 space-y-1">{ai.issues.slice(0,8).map((issue,index)=><div key={index}>• {issue.category}: {issue.description}</div>)}</div><div className="mt-2 border-t border-[#26304a] pt-2">{ai.proposal.actions.length} bounded edit action(s)</div><button className="tool-button primary mt-2 w-full" onClick={()=>void apply()}><CheckCircle2 size={11}/> Apply proposal</button></div>}
      </aside>
    </div>
  </div></div>;
}
