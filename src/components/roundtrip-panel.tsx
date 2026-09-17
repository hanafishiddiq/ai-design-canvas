"use client";

import { useMemo, useRef, useState } from "react";
import { Braces, CheckCircle2, Download, GitCompareArrows, Link2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { codeMappingCoverage, removeCodeMapping, suggestPageCodeMapping, upsertCodeMapping } from "@/lib/code-mapping";
import { downloadText } from "@/lib/export";
import { LocalProjectRepository } from "@/lib/storage";
import type { CodeTarget, DesignProject } from "@/lib/types";
import { compareRuntimeSnapshot, type QaReport, type RuntimePageSnapshot } from "@/lib/visual-qa";

export function RoundtripPanel() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<DesignProject | null>(null);
  const [target, setTarget] = useState<Extract<CodeTarget, "react" | "nextjs" | "html">>("nextjs");
  const [qa, setQa] = useState<QaReport | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => { setProject(await repository.load()); setQa(null); };
  const show = async () => { setOpen(true); setError(""); await refresh(); };
  const activePage = project?.pages.find((page) => page.id === project.activePageId) || project?.pages[0];
  const coverage = project ? codeMappingCoverage(project) : null;

  const save = async (next: DesignProject) => { await repository.save(next); setProject(next); };
  const addSuggested = async () => {
    if (!project || !activePage) return;
    try { await save(upsertCodeMapping(project, suggestPageCodeMapping(project, activePage.id, target))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const remove = async (id: string) => { if (project) await save(removeCodeMapping(project, id)); };
  const importSnapshot = async (file?: File) => {
    if (!project || !file) return;
    try {
      const snapshot = JSON.parse(await file.text()) as RuntimePageSnapshot;
      setQa(compareRuntimeSnapshot(project, snapshot));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };
  const downloadCaptureHelper = () => {
    if (!activePage) return;
    const source = `// Run this in an instrumented page whose elements preserve data-node-id.\n// Replace PAGE_ID only if you intentionally compare another design screen.\nconst PAGE_ID = ${JSON.stringify(activePage.id)};\nconst elements = [...document.querySelectorAll('[data-node-id]')];\nconst manifest = {\n  pageId: PAGE_ID, route: location.pathname, viewport: { width: innerWidth, height: innerHeight },\n  capturedAt: new Date().toISOString(),\n  nodes: elements.map((el) => { const r=el.getBoundingClientRect(), s=getComputedStyle(el); return { nodeId: el.dataset.nodeId, x:Math.round(r.x), y:Math.round(r.y), width:Math.round(r.width), height:Math.round(r.height), text:el.textContent?.trim(), color:s.color, background:s.backgroundColor, fontSize:parseFloat(s.fontSize), fontWeight:parseFloat(s.fontWeight), radius:parseFloat(s.borderRadius), visible:s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0 }; }).filter(n=>n.nodeId)\n};\ncopy(JSON.stringify(manifest,null,2));\nconsole.log(manifest);`;
    downloadText(`${activePage.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-capture.js`, source, "text/javascript");
  };

  if (!open) return <button className="fixed bottom-4 right-[650px] z-[84] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={show}><GitCompareArrows size={13} /> Roundtrip</button>;

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
    <div className="flex h-[min(760px,calc(100vh-3rem))] w-[min(1120px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#292e36] px-3"><GitCompareArrows size={14} className="text-[#8d99ff]" /><div className="flex-1"><div className="text-[12px] font-semibold">Design ↔ code roundtrip</div><div className="text-[9px] text-[#6e7784]">Stable mappings + runtime manifests for targeted QA.</div></div><button className="tool-button" onClick={refresh}><RefreshCw size={12}/></button><button className="tool-button" onClick={() => setOpen(false)}><X size={12}/></button></div>
      {error && <div className="border-b border-[#4b292e] bg-[#211215] px-4 py-2 text-[10px] text-[#e78c96]">{error}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-[390px_1fr]">
        <aside className="min-h-0 overflow-auto border-r border-[#242830] p-3">
          <div className="panel-label">Mapping coverage</div>
          {coverage && <div className="grid grid-cols-3 gap-2">{Object.entries(coverage).map(([name,value]) => <div key={name} className="rounded-lg border border-[#292e36] bg-[#111419] p-2.5"><div className="text-[14px] font-semibold">{value.mapped}/{value.total}</div><div className="text-[8px] uppercase text-[#68717d]">{name}</div></div>)}</div>}
          <div className="mt-4 panel-label">Map active screen</div><div className="flex gap-1.5"><select className="select" value={target} onChange={(event) => setTarget(event.target.value as typeof target)}><option value="nextjs">Next.js</option><option value="react">React</option><option value="html">HTML</option></select><button className="tool-button primary shrink-0" onClick={() => void addSuggested()} disabled={!activePage}><Link2 size={11}/> Map</button></div>
          <div className="mt-2 text-[9px] leading-4 text-[#68717d]">Suggested mapping uses the screen route and generated component symbol. Agents may update file/symbol metadata later through project JSON/MCP.</div>
          <div className="mt-4 panel-label">Mappings</div><div className="space-y-1.5">{project?.codeMappings.length ? project.codeMappings.map((mapping) => <div key={mapping.id} className="rounded-lg border border-[#292e36] bg-[#111419] p-2.5"><div className="flex items-start gap-2"><Braces size={11} className="mt-0.5 text-[#737d8a]"/><div className="min-w-0 flex-1"><div className="truncate font-mono text-[9px] text-[#b2b9c5]">{mapping.filePath}</div><div className="mt-1 text-[8px] text-[#646d79]">{mapping.target}{mapping.symbol?` · ${mapping.symbol}`:""}{mapping.route?` · ${mapping.route}`:""}</div></div><button className="grid size-6 place-items-center rounded text-[#6f7784] hover:text-[#e88893]" onClick={() => void remove(mapping.id)}><Trash2 size={10}/></button></div></div>) : <div className="rounded-lg border border-[#292e36] p-3 text-[9px] text-[#68717d]">No code mappings yet.</div>}</div>
        </aside>
        <section className="flex min-h-0 flex-col">
          <div className="border-b border-[#242830] p-3"><div className="flex items-center gap-2"><div className="flex-1"><div className="panel-label !mb-1">Visual QA manifest</div><div className="text-[9px] text-[#68717d]">Generated code preserves <code>data-node-id</code>. Capture runtime geometry/styles, then compare them against the active design.</div></div><button className="tool-button" onClick={downloadCaptureHelper} disabled={!activePage}><Download size={11}/> Capture helper</button><button className="tool-button primary" onClick={() => fileRef.current?.click()}><Upload size={11}/> Import manifest</button><input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event)=>void importSnapshot(event.target.files?.[0])}/></div></div>
          <div className="min-h-0 flex-1 overflow-auto p-4">{!qa ? <div className="grid h-full place-items-center"><div className="max-w-md text-center"><GitCompareArrows size={28} className="mx-auto text-[#505966]"/><div className="mt-3 text-[12px] font-semibold">No runtime manifest loaded</div><div className="mt-1 text-[10px] leading-5 text-[#68717d]">This layer compares mapped runtime nodes to design geometry/content/style. It does not pretend to be pixel-level screenshot diff yet; screenshot-classification can be added on top without changing the stable mapping contract.</div></div></div> : <div><div className="grid grid-cols-4 gap-2"><div className="rounded-lg border border-[#294334] bg-[#101a15] p-3"><div className="text-[22px] font-semibold text-[#7bd39f]">{qa.score}</div><div className="text-[8px] uppercase text-[#688a76]">QA score</div></div><div className="rounded-lg border border-[#292e36] p-3"><div className="text-[18px] font-semibold">{qa.matched}</div><div className="text-[8px] uppercase text-[#68717d]">matched</div></div><div className="rounded-lg border border-[#292e36] p-3"><div className="text-[18px] font-semibold">{qa.designNodes}</div><div className="text-[8px] uppercase text-[#68717d]">design nodes</div></div><div className="rounded-lg border border-[#292e36] p-3"><div className="text-[18px] font-semibold">{qa.runtimeNodes}</div><div className="text-[8px] uppercase text-[#68717d]">runtime nodes</div></div></div><div className="mt-4 space-y-2">{qa.issues.length===0?<div className="flex items-center gap-2 rounded-lg border border-[#294334] bg-[#101a15] p-3 text-[10px] text-[#78c999]"><CheckCircle2 size={12}/> No mapped drift detected within tolerance.</div>:qa.issues.map((issue,index)=><div key={`${issue.nodeId}-${index}`} className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[8px] ${issue.severity==='error'?'bg-[#35181d] text-[#ed8f99]':issue.severity==='warning'?'bg-[#352a16] text-[#dfbd7c]':'bg-[#182331] text-[#819fc5]'}`}>{issue.kind}</span><span className="font-mono text-[9px] text-[#77818e]">{issue.nodeId}</span></div><div className="mt-1.5 text-[10px] leading-4 text-[#b1b8c3]">{issue.message}</div></div>)}</div></div>}</div>
        </section>
      </div>
    </div>
  </div>;
}
