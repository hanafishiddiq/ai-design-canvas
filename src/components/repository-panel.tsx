"use client";

import { useMemo, useRef, useState } from "react";
import { FileCode2, GitBranch, RefreshCw, Upload, WandSparkles, X } from "lucide-react";
import { applyRepositoryMappingSuggestions, parseRepositoryManifest, repositoryContextSummary, suggestRepositoryMappings, tokenDriftReport, type RepositoryManifest } from "@/lib/repository-manifest";
import { LocalProjectRepository } from "@/lib/storage";

export function RepositoryPanel() {
  const repository = useMemo(()=>new LocalProjectRepository(),[]);
  const fileRef=useRef<HTMLInputElement>(null);
  const [open,setOpen]=useState(false);
  const [manifest,setManifest]=useState<RepositoryManifest|null>(null);
  const [project,setProject]=useState<Awaited<ReturnType<LocalProjectRepository["load"]>>>(null);
  const [error,setError]=useState("");
  const refresh=async()=>setProject(await repository.load());
  const show=async()=>{setOpen(true);await refresh();};
  const importManifest=async(file?:File)=>{
    if(!file)return;
    try{setManifest(parseRepositoryManifest(await file.text()));setError("");}
    catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
    finally{if(fileRef.current)fileRef.current.value="";}
  };
  const suggestions=project&&manifest?suggestRepositoryMappings(project,manifest):[];
  const drift=project&&manifest?tokenDriftReport(project,manifest):[];
  const apply=async()=>{
    if(!project||!manifest)return;
    const next=applyRepositoryMappingSuggestions(project,suggestions);
    await repository.save(next);setProject(next);
  };
  if(!open)return <button className="fixed bottom-14 right-[265px] z-[88] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={show}><GitBranch size={13}/> Repo</button>;
  const summary=manifest?repositoryContextSummary(manifest):null;
  return <div className="fixed inset-0 z-[85] grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
    <div className="flex h-[min(760px,calc(100vh-3rem))] w-[min(1100px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
      <div className="flex h-12 items-center gap-2 border-b border-[#292e36] px-3"><GitBranch size={14} className="text-[#8d99ff]"/><div className="flex-1"><div className="text-[12px] font-semibold">Repository context</div><div className="text-[9px] text-[#6e7784]">Static manifest discovery + non-destructive mapping repair.</div></div><button className="tool-button" onClick={refresh}><RefreshCw size={12}/></button><button className="tool-button primary" onClick={()=>fileRef.current?.click()}><Upload size={11}/> Manifest</button><input ref={fileRef} className="hidden" type="file" accept=".json,application/json" onChange={(event)=>void importManifest(event.target.files?.[0])}/><button className="tool-button" onClick={()=>setOpen(false)}><X size={12}/></button></div>
      {error&&<div className="border-b border-[#4b292e] bg-[#211215] px-4 py-2 text-[10px] text-[#e78c96]">{error}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr]">
        <aside className="min-h-0 overflow-auto border-r border-[#242830] p-3">
          {!summary?<div className="rounded-lg border border-dashed border-[#303640] p-5 text-center text-[10px] leading-5 text-[#68717d]">Generate a manifest in the production repository:<br/><code className="mt-2 block rounded bg-[#090b0e] p-2 text-left">npm run repo:scan -- --root ../your-app --out repo.adc.json</code></div>:<>
            <div className="panel-label">Repository</div><div className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="text-[12px] font-semibold">{summary.rootName}</div><div className="mt-1 text-[9px] text-[#68717d]">{summary.frameworks.join(" · ")||"framework unknown"}</div><div className="mt-2 grid grid-cols-2 gap-1 text-[9px] text-[#7a8491]"><span>{summary.routes} routes</span><span>{summary.components} components</span><span>{summary.tokens} CSS tokens</span><span>{summary.assets} assets</span></div><div className="mt-2 truncate font-mono text-[8px] text-[#58616d]">{summary.fingerprint}</div></div>
            <div className="mt-4 panel-label">Mapping proposals</div><div className="space-y-1.5">{suggestions.slice(0,20).map((suggestion,index)=><div key={index} className="rounded border border-[#292e36] p-2"><div className="flex justify-between text-[9px]"><span className="truncate">{suggestion.mapping.filePath}</span><span className="text-[#75c99a]">{Math.round(suggestion.confidence*100)}%</span></div><div className="mt-1 text-[8px] text-[#68717d]">{suggestion.reason}</div></div>)}</div><button className="tool-button primary mt-3 w-full" disabled={!suggestions.length} onClick={()=>void apply()}><WandSparkles size={11}/> Apply high-confidence mappings</button>
          </>}
        </aside>
        <section className="min-h-0 overflow-auto p-4">
          <div className="panel-label">Routes & components</div>{manifest?<div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="mb-2 text-[10px] font-semibold">Routes</div>{manifest.routes.slice(0,50).map((route)=><div key={route.path+route.file} className="flex gap-2 border-t border-[#20242b] py-1.5 text-[9px]"><span className="w-28 truncate text-[#aeb6c2]">{route.path}</span><span className="min-w-0 flex-1 truncate font-mono text-[#626c78]">{route.file}</span></div>)}</div><div className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="mb-2 text-[10px] font-semibold">Components</div>{manifest.components.slice(0,50).map((component)=><div key={component.name+component.file} className="flex gap-2 border-t border-[#20242b] py-1.5 text-[9px]"><span className="w-28 truncate text-[#aeb6c2]">{component.name}</span><span className="min-w-0 flex-1 truncate font-mono text-[#626c78]">{component.file}</span></div>)}</div></div>:<div className="grid h-48 place-items-center text-[10px] text-[#68717d]"><FileCode2 size={24}/></div>}
          {drift.length>0&&<div className="mt-5"><div className="panel-label">Token drift hints</div><div className="grid grid-cols-2 gap-2">{drift.map((item)=><div key={item.token} className="rounded border border-[#292e36] p-2 text-[9px]"><div className="flex justify-between"><span>{item.token}</span><span className={item.status==="mapped"?"text-[#70cf99]":item.status==="different"?"text-[#dfbd7c]":"text-[#e28a94]"}>{item.status}</span></div><div className="mt-1 font-mono text-[8px] text-[#68717d]">{String(item.design)}{item.code?` ↔ ${item.code}`:""}</div></div>)}</div></div>}
        </section>
      </div>
    </div>
  </div>;
}
