"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { BrainCircuit, ImagePlus, LayoutTemplate, Palette, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { parseDesignMd, serializeDesignMd } from "@/lib/design-md";
import { generateTokens } from "@/lib/foundations";
import { analyzeReferenceFile, referenceSummary, suggestedAccent } from "@/lib/reference-analysis";
import { referenceToDraftPage } from "@/lib/reference-to-design";
import { LocalProjectRepository } from "@/lib/storage";
import type { DesignProject, DesignReference, DesignTokens, ReferenceKind } from "@/lib/types";
import { visionPlanToPage } from "@/lib/vision";
import { HostedVisionProvider, type VisionProviderStatus } from "@/lib/vision-provider";

function retokenize(project: DesignProject, oldTokens: DesignTokens, nextTokens: DesignTokens) {
  const pairs = Object.keys(oldTokens.colors).map((key) => {
    const typed = key as keyof DesignTokens["colors"];
    return [oldTokens.colors[typed], nextTokens.colors[typed]] as const;
  });
  const replace = (value?: string) => pairs.find(([from]) => from === value)?.[1] || value;
  for (const page of project.pages) {
    page.background = replace(page.background) || page.background;
    for (const node of page.nodes) {
      node.style.background = replace(node.style.background);
      node.style.color = replace(node.style.color);
      node.style.borderColor = replace(node.style.borderColor);
    }
  }
}

export function ReferenceLibrary() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const visionProvider = useMemo(() => new HostedVisionProvider(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<DesignProject | null>(null);
  const [kind, setKind] = useState<ReferenceKind>("screenshot");
  const [busy, setBusy] = useState(false);
  const [visionBusyId, setVisionBusyId] = useState<string | null>(null);
  const [visionStatus, setVisionStatus] = useState<VisionProviderStatus | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [saved, status] = await Promise.all([repository.load(), visionProvider.status()]);
    setProject(saved);
    setVisionStatus(status);
  };
  const show = async () => { setOpen(true); await refresh(); };

  const save = async (next: DesignProject) => {
    next.updatedAt = new Date().toISOString();
    await repository.save(next);
    setProject(structuredClone(next));
  };

  const upload = async (file?: File) => {
    if (!project || !file) return;
    setBusy(true); setError("");
    try {
      const reference = await analyzeReferenceFile(file, kind);
      const next = structuredClone(project);
      next.references.push(reference);
      await save(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const remove = async (id: string) => {
    if (!project) return;
    const next = structuredClone(project);
    next.references = next.references.filter((reference) => reference.id !== id);
    await save(next);
  };

  const applyDirection = async (reference: DesignReference) => {
    if (!project) return;
    const next = structuredClone(project);
    const oldTokens = next.tokens;
    next.direction.accent = suggestedAccent(reference);
    next.direction.theme = reference.analysis.luminance < 0.48 ? "dark" : "light";
    next.tokens = generateTokens(next.direction);
    retokenize(next, oldTokens, next.tokens);
    const prose = parseDesignMd(next.designMd).prose;
    const referenceNote = `\n\n## Reference direction\n\n${referenceSummary(reference)} Use this as inspiration for visual weight and palette, not as a literal copy.`;
    next.designMd = serializeDesignMd(next.name, next.direction, next.tokens, `${prose}${referenceNote}`.trim());
    await save(next);
  };

  const appendPage = async (reference: DesignReference, page: ReturnType<typeof referenceToDraftPage>, interpretation?: { summary: string; model: string; notes: string[] }) => {
    if (!project) return;
    const next = structuredClone(project);
    next.pages.push(page);
    next.activePageId = page.id;
    const storedReference = next.references.find((item) => item.id === reference.id);
    if (storedReference && interpretation) storedReference.notes = `AI interpretation (${interpretation.model}): ${interpretation.summary}`;
    if (interpretation) {
      const parsed = parseDesignMd(next.designMd);
      const note = `\n\n## Vision interpretation\n\nReference “${reference.name}” analyzed with ${interpretation.model}: ${interpretation.summary}\n\n${interpretation.notes.map((item) => `- ${item}`).join("\n")}`;
      next.designMd = serializeDesignMd(next.name, next.direction, next.tokens, `${parsed.prose}${note}`.trim());
    }
    await save(next);
    window.location.reload();
  };

  const createDraft = async (reference: DesignReference) => {
    if (!project) return;
    const maxRight = Math.max(...project.pages.map((page) => page.x + page.width), 0);
    const minTop = Math.min(...project.pages.map((page) => page.y), 80);
    await appendPage(reference, referenceToDraftPage(reference, project.tokens, maxRight + 100, minTop));
  };

  const createVisionDraft = async (reference: DesignReference) => {
    if (!project || !visionStatus?.available) return;
    setVisionBusyId(reference.id); setError("");
    try {
      const result = await visionProvider.analyze(reference, project);
      const maxRight = Math.max(...project.pages.map((page) => page.x + page.width), 0);
      const minTop = Math.min(...project.pages.map((page) => page.y), 80);
      const page = visionPlanToPage(result.plan, reference, project.tokens, maxRight + 100, minTop);
      await appendPage(reference, page, { summary: result.plan.summary, model: result.model, notes: result.plan.visualDirection.notes });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setVisionBusyId(null); }
  };

  if (!open) return <button className="fixed bottom-4 right-[345px] z-[87] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={show}><ImagePlus size={13} /> References</button>;

  return <div className="fixed inset-0 z-[83] grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
    <div className="flex h-[min(760px,calc(100vh-3rem))] w-[min(1120px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#292e36] px-3">
        <ImagePlus size={14} className="text-[#8d99ff]" /><div className="flex-1"><div className="text-[12px] font-semibold">Reference library</div><div className="text-[9px] text-[#6e7784]">Local analysis by default; hosted vision only runs on explicit request.</div></div>
        <span className={`rounded border px-2 py-1 text-[9px] ${visionStatus?.available ? "border-[#27513a] bg-[#112219] text-[#77d49d]" : "border-[#30353e] bg-[#14171c] text-[#707986]"}`}>{visionStatus?.available ? `Vision ready · ${visionStatus.model}` : "Local-only vision"}</span>
        <select className="select !w-[130px]" value={kind} onChange={(event) => setKind(event.target.value as ReferenceKind)}><option value="screenshot">Screenshot</option><option value="sketch">Sketch</option><option value="moodboard">Moodboard</option><option value="asset">Asset</option></select>
        <button className="tool-button primary" disabled={!project || busy} onClick={() => inputRef.current?.click()}><Upload size={12} /> {busy ? "Analyzing…" : "Add image"}</button>
        <button className="tool-button" onClick={refresh}><RefreshCw size={12} /></button>
        <button className="tool-button" onClick={() => setOpen(false)}><X size={12} /></button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
      </div>
      {error && <div className="border-b border-[#4b292e] bg-[#211215] px-4 py-2 text-[10px] text-[#e78c96]">{error}</div>}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!project ? <div className="grid h-full place-items-center text-[11px] text-[#6d7582]">No project is saved yet.</div> : project.references.length === 0 ? <div className="grid h-full place-items-center"><div className="max-w-sm text-center"><ImagePlus className="mx-auto text-[#4f5865]" size={28} /><div className="mt-3 text-[12px] font-semibold">No visual references yet</div><div className="mt-1 text-[10px] leading-4 text-[#6f7885]">Upload a screenshot, wireframe, moodboard or asset. The browser compresses and analyzes it locally before storing it in the portable project.</div></div></div> : <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">{project.references.map((reference) => <article key={reference.id} className="overflow-hidden rounded-xl border border-[#2b3039] bg-[#111419]">
          <div className="flex h-[190px] items-center justify-center overflow-hidden bg-[#080a0d]"><Image src={reference.dataUrl} alt={reference.name} width={reference.analysis.width} height={reference.analysis.height} unoptimized className="max-h-full max-w-full object-contain" /></div>
          <div className="p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{reference.name}</div><div className="mt-0.5 text-[9px] uppercase tracking-wide text-[#626c78]">{reference.kind} · {reference.analysis.width}×{reference.analysis.height}</div></div><button className="grid size-7 place-items-center rounded text-[#6f7783] hover:bg-[#2a171a] hover:text-[#ec8792]" onClick={() => void remove(reference.id)}><Trash2 size={12} /></button></div>
            <div className="mt-3 flex gap-1">{reference.analysis.dominantColors.map((color) => <span key={color} className="h-5 flex-1 rounded-sm border border-white/5" style={{ background: color }} title={color} />)}</div>
            <div className="mt-2 text-[9px] leading-4 text-[#727b88]">{reference.analysis.contrast} contrast · luminance {reference.analysis.luminance}{reference.notes ? <span className="block mt-1 text-[#8b94a3]">{reference.notes}</span> : null}</div>
            <div className="mt-3 grid grid-cols-3 gap-1.5"><button className="tool-button" onClick={() => void applyDirection(reference)}><Palette size={11} /> Direction</button><button className="tool-button" onClick={() => void createDraft(reference)}><LayoutTemplate size={11} /> Local draft</button><button className="tool-button primary" disabled={!visionStatus?.available || visionBusyId === reference.id} title={visionStatus?.available ? "Send this reference to the configured hosted vision provider" : visionStatus?.reason || "Hosted vision is not configured"} onClick={() => void createVisionDraft(reference)}><BrainCircuit size={11} /> {visionBusyId === reference.id ? "Reading…" : "AI interpret"}</button></div>
          </div>
        </article>)}</div>}
      </div>
      <div className="border-t border-[#242830] px-4 py-2 text-[9px] text-[#626b78]">Local draft never uploads the image. “AI interpret” sends only the selected reference to the server-side configured provider and returns structured semantic JSON—not free-form HTML.</div>
    </div>
  </div>;
}
