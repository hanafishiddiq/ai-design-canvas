"use client";

import { useMemo, useState } from "react";
import { Monitor, RefreshCw, Smartphone, Tablet, X } from "lucide-react";
import { adaptPageToViewport, viewportPresets } from "@/lib/responsive";
import { LocalProjectRepository } from "@/lib/storage";
import type { DesignProject } from "@/lib/types";
import { StudioNodeLayer } from "./studio-node";

const icons = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;

export function ResponsivePreview() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<DesignProject | null>(null);
  const [presetId, setPresetId] = useState("mobile");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setProject(await repository.load()); } finally { setLoading(false); }
  };

  const show = async () => { setOpen(true); await refresh(); };
  const preset = viewportPresets.find((item) => item.id === presetId) || viewportPresets[0];
  const sourcePage = project?.pages.find((page) => page.id === project.activePageId) || project?.pages[0];
  const page = sourcePage ? adaptPageToViewport(sourcePage, preset.width, Math.max(sourcePage.height, preset.height)) : null;
  const scale = page ? Math.min(0.72, 620 / page.height, 780 / page.width) : 1;

  if (!open) {
    return <button className="fixed bottom-4 right-[148px] z-[89] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={show}><Monitor size={13} /> Responsive</button>;
  }

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
      <div className="flex max-h-full w-[min(1120px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#292e36] px-3">
          <Monitor size={14} className="text-[#8c98ff]" />
          <div className="flex-1"><div className="text-[12px] font-semibold">Responsive constraint preview</div><div className="text-[9px] text-[#6e7784]">Deterministic layout projection; source design is not modified.</div></div>
          <div className="flex gap-1">{viewportPresets.map((item) => { const Icon = icons[item.id as keyof typeof icons] || Monitor; return <button key={item.id} className={`tool-button ${presetId === item.id ? "!border-[#5965a0] !bg-[#202637]" : ""}`} onClick={() => setPresetId(item.id)}><Icon size={11} /> {item.name}</button>; })}</div>
          <button className="tool-button" onClick={refresh}><RefreshCw size={12} className={loading ? "animate-spin" : ""} /></button>
          <button className="tool-button" onClick={() => setOpen(false)}><X size={12} /></button>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="w-[230px] shrink-0 border-r border-[#242830] p-3">
            <div className="panel-label">Viewport</div>
            <div className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="text-[18px] font-semibold">{preset.width} × {preset.height}</div><div className="mt-1 text-[10px] text-[#717a87]">{preset.name} projection</div></div>
            <div className="mt-4 panel-label">Constraint semantics</div>
            <div className="space-y-1.5 text-[10px] leading-4 text-[#77808d]"><div><b className="text-[#a7aeb9]">left/right</b> pins an edge.</div><div><b className="text-[#a7aeb9]">left-right</b> stretches width.</div><div><b className="text-[#a7aeb9]">center</b> preserves center offset.</div><div><b className="text-[#a7aeb9]">scale</b> scales geometry proportionally.</div><div>min/max and breakpoint visibility remain explicit metadata.</div></div>
            {sourcePage && <div className="mt-4 rounded-lg border border-[#292e36] p-2.5 text-[10px] text-[#747d8a]"><div className="font-semibold text-[#adb4bf]">{sourcePage.name}</div><div className="mt-1">Source: {sourcePage.width}×{sourcePage.height}</div><div>Target: {preset.width}×{Math.max(sourcePage.height, preset.height)}</div></div>}
          </div>
          <div className="canvas-grid relative min-h-[680px] min-w-0 flex-1 overflow-auto p-10">
            {page ? <div className="mx-auto origin-top overflow-hidden ring-1 ring-[#39404c] shadow-[0_30px_100px_rgba(0,0,0,.45)]" style={{ width: page.width, height: page.height, background: page.background, transform: `scale(${scale})`, transformOrigin: "top center", fontFamily: project?.tokens.typography.fontFamily }}><div className="relative h-full w-full"><StudioNodeLayer allNodes={page.nodes} selectedIds={[]} interactive={false} /></div></div> : <div className="grid h-full place-items-center text-[11px] text-[#6f7783]">No saved project available.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
