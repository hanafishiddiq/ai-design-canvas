"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Code2, Copy, Download, FileJson, Package, RefreshCw, Upload, X } from "lucide-react";
import { downloadText, exportDtcgTokens, exportPageHtml, exportPageReact, exportPageSvg, exportProjectJson } from "@/lib/export";
import { createProjectBundle, parseProjectBundle, serializeProjectBundle, verifyProjectBundle } from "@/lib/project-bundle";
import { LocalProjectRepository } from "@/lib/storage";
import type { DesignProject } from "@/lib/types";

type Format = "react" | "html" | "svg" | "dtcg" | "json";

export function CodeExportPanel() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const importRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<DesignProject | null>(null);
  const [format, setFormat] = useState<Format>("react");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setLoading(true);
    try { setProject(await repository.load()); } finally { setLoading(false); }
  };
  const show = async () => { setOpen(true); setMessage(""); await refresh(); };
  const page = project?.pages.find((item) => item.id === project.activePageId) || project?.pages[0];
  const source = useMemo(() => {
    if (!project || !page) return "";
    if (format === "react") return exportPageReact(project, page);
    if (format === "html") return exportPageHtml(project, page);
    if (format === "svg") return exportPageSvg(project, page);
    if (format === "dtcg") return exportDtcgTokens(project);
    return exportProjectJson(project);
  }, [format, page, project]);

  const copy = async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  const download = () => {
    if (!project || !page) return;
    const base = page.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "screen";
    if (format === "react") downloadText(`${base}.tsx`, source, "text/typescript");
    else if (format === "html") downloadText(`${base}.html`, source, "text/html");
    else if (format === "svg") downloadText(`${base}.svg`, source, "image/svg+xml");
    else if (format === "dtcg") downloadText(`${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "project"}.tokens.json`, source, "application/json");
    else downloadText(`${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "project"}.canvas.json`, source, "application/json");
  };
  const exportBundle = async () => {
    if (!project) return;
    const bundle = await createProjectBundle(project);
    const base = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
    downloadText(`${base}.adc.json`, serializeProjectBundle(bundle), "application/json");
    setMessage(`Bundle exported · ${bundle.manifest.fingerprint.slice(0, 12)}…`);
  };
  const importBundle = async (file?: File) => {
    if (!file) return;
    try {
      const bundle = parseProjectBundle(await file.text());
      const verification = await verifyProjectBundle(bundle);
      if (!verification.valid) throw new Error(`Bundle fingerprint mismatch. Expected ${verification.expected || "missing"}, got ${verification.actual}.`);
      await repository.save(bundle.project);
      setMessage(`Imported ${bundle.project.name} · schema v${bundle.project.version}`);
      window.setTimeout(() => window.location.reload(), 200);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { if (importRef.current) importRef.current.value = ""; }
  };

  if (!open) return <button className="fixed bottom-4 right-[260px] z-[88] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={show}><Code2 size={13} /> Code</button>;

  return <div className="fixed inset-0 z-[84] grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
    <div className="flex h-[min(760px,calc(100vh-3rem))] w-[min(1050px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#292e36] px-3">
        <Code2 size={14} className="text-[#8d99ff]" /><div className="flex-1"><div className="text-[12px] font-semibold">Semantic code & project export</div><div className="text-[9px] text-[#6e7784]">Code generation plus portable project bundles for Git, backup and agent handoff.</div></div>
        <button className="tool-button" onClick={() => void exportBundle()} disabled={!project}><Package size={11}/> Bundle</button>
        <button className="tool-button" onClick={() => importRef.current?.click()}><Upload size={11}/> Import</button>
        <input ref={importRef} type="file" accept=".json,.adc.json,application/json" className="hidden" onChange={(event) => void importBundle(event.target.files?.[0])}/>
        <button className="tool-button" onClick={refresh}><RefreshCw size={12} className={loading ? "animate-spin" : ""} /></button>
        <button className="tool-button" onClick={() => setOpen(false)}><X size={12} /></button>
      </div>
      {message && <div className="border-b border-[#292e36] bg-[#11151b] px-3 py-2 text-[9px] text-[#8993a0]">{message}</div>}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[#242830] px-3">
        {(["react", "html", "svg", "dtcg", "json"] as Format[]).map((item) => <button key={item} className={`tool-button ${format === item ? "!border-[#5965a0] !bg-[#202637]" : ""}`} onClick={() => setFormat(item)}>{item === "json" || item === "dtcg" ? <FileJson size={11} /> : <Code2 size={11} />}{item === "react" ? "React TSX" : item.toUpperCase()}</button>)}
        <div className="flex-1" />
        <span className="mr-2 text-[9px] text-[#626b78]">{page?.name || "No active screen"}</span>
        <button className="tool-button" disabled={!source} onClick={copy}>{copied ? <Check size={11} /> : <Copy size={11} />}{copied ? "Copied" : "Copy"}</button>
        <button className="tool-button primary" disabled={!source} onClick={download}><Download size={11} /> Download</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#090b0e] p-4"><pre className="m-0 whitespace-pre-wrap font-mono text-[11px] leading-[1.65] text-[#aeb7c5]">{source || "No saved project available."}</pre></div>
    </div>
  </div>;
}
