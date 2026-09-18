"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Check, RefreshCw, Sparkles, X, XCircle } from "lucide-react";
import { proposalToOperations, type AiEditProposal } from "@/lib/ai-edit";
import { EXTENSION_SKILL_EVENT } from "@/lib/extensions";
import { applyOperation } from "@/lib/operations";
import { LocalProjectRepository } from "@/lib/storage";
import type { DesignProject } from "@/lib/types";

export function AiEditPanel() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<DesignProject | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("Improve hierarchy and spacing while preserving the current design system.");
  const [proposal, setProposal] = useState<AiEditProposal | null>(null);
  const [model, setModel] = useState("");
  const [available, setAvailable] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const page = project?.pages.find((item) => item.id === project.activePageId) || project?.pages[0];

  const refresh = async () => {
    const [saved, statusResponse] = await Promise.all([repository.load(), fetch("/api/ai/status", { cache: "no-store" })]);
    setProject(saved);
    if (statusResponse.ok) {
      const body = await statusResponse.json() as { providers?: { openai?: { configured?: boolean; editModel?: string; model?: string } } };
      const openai = body.providers?.openai;
      setAvailable(Boolean(openai?.configured));
      setModel(openai?.editModel || openai?.model || "");
      setStatusReason(openai?.configured ? "" : "OPENAI_API_KEY is not configured on this deployment.");
    } else { setAvailable(false); setStatusReason(`Provider status failed: ${statusResponse.status}`); }
  };

  useEffect(() => {
    const onSkill = (event: Event) => {
      const detail = (event as CustomEvent<{ instruction?: string; scope?: "selection" | "page" }>).detail;
      if (!detail?.instruction) return;
      setInstruction(detail.instruction);
      if (detail.scope === "page") setSelectedIds([]);
      setProposal(null); setError(""); setOpen(true);
      void refresh();
    };
    window.addEventListener(EXTENSION_SKILL_EVENT, onSkill);
    return () => window.removeEventListener(EXTENSION_SKILL_EVENT, onSkill);
  });


  const show = async () => { setOpen(true); setProposal(null); setError(""); await refresh(); };
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const propose = async () => {
    if (!project || !page || !available || !instruction.trim()) return;
    setBusy(true); setError(""); setProposal(null);
    try {
      const response = await fetch("/api/ai/edit", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction, page, selectedNodeIds: selectedIds, designMd: project.designMd, tokens: project.tokens }),
      });
      const body = await response.json() as { error?: string; proposal?: AiEditProposal; model?: string };
      if (!response.ok || !body.proposal) throw new Error(body.error || `AI edit request failed with ${response.status}.`);
      setProposal(body.proposal); if (body.model) setModel(body.model);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const apply = async () => {
    if (!project || !page || !proposal) return;
    try {
      const operations = proposalToOperations(proposal, page, selectedIds);
      if (!operations.length) throw new Error("The proposal contained no valid in-scope operations.");
      const next = applyOperation(project, { type: "batch", operations }).project;
      await repository.save(next);
      window.location.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  if (!open) return <button className="fixed bottom-4 right-[460px] z-[86] flex h-9 items-center gap-2 rounded-lg border border-[#4b4670] bg-[#19172a]/95 px-3 text-[11px] text-[#d7d3ff] shadow-xl backdrop-blur hover:bg-[#211e36]" onClick={show}><BrainCircuit size={13} /> AI Edit</button>;

  return <div className="fixed inset-0 z-[82] grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
    <div className="flex h-[min(760px,calc(100vh-3rem))] w-[min(1080px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#292e36] px-3">
        <BrainCircuit size={14} className="text-[#9c93ff]" /><div className="flex-1"><div className="text-[12px] font-semibold">AI edit proposal</div><div className="text-[9px] text-[#6e7784]">Bounded actions → preview → explicit Apply. No silent canvas overwrite.</div></div>
        <span className={`rounded border px-2 py-1 text-[9px] ${available ? "border-[#304b3b] text-[#79c99b]" : "border-[#3a353d] text-[#7d747f]"}`}>{available ? `Ready · ${model}` : "Provider unavailable"}</span>
        <button className="tool-button" onClick={refresh}><RefreshCw size={12} /></button><button className="tool-button" onClick={() => setOpen(false)}><X size={12} /></button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr]">
        <aside className="min-h-0 overflow-auto border-r border-[#242830] p-3">
          <div className="panel-label">Scope · {page?.name || "No page"}</div>
          <div className="mb-2 flex gap-1"><button className="tool-button" disabled={!page} onClick={() => setSelectedIds(page?.nodes.map((node) => node.id) || [])}>Select all</button><button className="tool-button" onClick={() => setSelectedIds([])}>Whole page / clear explicit scope</button></div>
          <div className="space-y-1">{page?.nodes.map((node) => <label key={node.id} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[10px] ${selectedIds.includes(node.id) ? "bg-[#211e34] text-[#ddd9ff]" : "text-[#818996] hover:bg-[#151820]"}`}><input type="checkbox" checked={selectedIds.includes(node.id)} onChange={() => toggle(node.id)} /><span className="w-12 text-[8px] uppercase text-[#5e6672]">{node.type}</span><span className="min-w-0 flex-1 truncate">{node.name}</span></label>)}</div>
        </aside>
        <section className="flex min-h-0 flex-col">
          <div className="border-b border-[#242830] p-3"><div className="panel-label">Instruction</div><textarea className="textarea min-h-[92px]" value={instruction} onChange={(event) => setInstruction(event.target.value)} /><div className="mt-2 flex items-center gap-2"><button className="tool-button primary" disabled={!available || busy || !project || !instruction.trim()} onClick={propose}><Sparkles size={12} /> {busy ? "Thinking…" : "Propose changes"}</button><span className="text-[9px] text-[#68717d]">{selectedIds.length ? `${selectedIds.length} explicit nodes in scope` : "Whole active page in scope"}</span></div>{!available && <div className="mt-2 text-[9px] text-[#8d7780]">{statusReason}</div>}</div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {error && <div className="mb-3 rounded-lg border border-[#4b292e] bg-[#211215] p-3 text-[10px] text-[#ea8b96]"><div className="mb-1 flex items-center gap-1.5 font-semibold"><XCircle size={11} /> Error</div>{error}</div>}
            {!proposal ? <div className="grid h-full place-items-center"><div className="max-w-md text-center text-[10px] leading-5 text-[#6d7582]">Choose a scope, describe the intended change, and request a proposal. Existing nodes outside the explicit scope are filtered out again on the client before Apply.</div></div> : <div className="space-y-4">
              <div className="rounded-xl border border-[#34325a] bg-[#15152a] p-4"><div className="text-[12px] font-semibold text-[#ddd9ff]">{proposal.summary}</div><div className="mt-1 text-[10px] leading-5 text-[#9693b5]">{proposal.rationale}</div>{proposal.warnings.length > 0 && <div className="mt-2 text-[9px] text-[#c5a279]">{proposal.warnings.join(" · ")}</div>}</div>
              <div><div className="panel-label">Proposed actions · {proposal.actions.length}</div><div className="space-y-1.5">{proposal.actions.map((action, index) => <div key={`${action.action}-${index}`} className="rounded-lg border border-[#292e36] bg-[#111419] px-3 py-2 text-[10px]"><span className="font-mono text-[#a49cff]">{action.action}</span><span className="ml-2 text-[#707986]">{action.nodeId || action.name || action.kind || "new node"}</span>{action.text && <div className="mt-1 truncate text-[#9aa2ad]">{action.text}</div>}</div>)}</div></div>
              <div className="flex gap-2 border-t border-[#242830] pt-3"><button className="tool-button primary" onClick={apply}><Check size={12} /> Apply valid in-scope actions</button><button className="tool-button" onClick={() => setProposal(null)}><X size={12} /> Reject</button></div>
            </div>}
          </div>
        </section>
      </div>
    </div>
  </div>;
}
