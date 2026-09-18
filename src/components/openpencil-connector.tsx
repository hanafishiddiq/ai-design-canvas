"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Plug, RefreshCw, Send, Terminal, XCircle } from "lucide-react";
import { inferOpenPencilCapabilities, OpenPencilMcpClient, type OpenPencilMcpStatus, type OpenPencilSyncReport } from "@/lib/openpencil-mcp";
import { LocalProjectRepository } from "@/lib/storage";

const ENDPOINT_KEY = "ai-design-canvas.openpencil.endpoint";
const DEFAULT_ENDPOINT = "http://127.0.0.1:3100/mcp";

export function OpenPencilConnector() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_ENDPOINT;
    return localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT;
  });
  const [status, setStatus] = useState<OpenPencilMcpStatus | null>(null);
  const [report, setReport] = useState<OpenPencilSyncReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const client = useMemo(() => new OpenPencilMcpClient(endpoint), [endpoint]);
  const capabilities = useMemo(() => status?.verified ? inferOpenPencilCapabilities(status.tools) : null, [status]);

  const check = async () => {
    setChecking(true);
    setError("");
    setReport(null);
    localStorage.setItem(ENDPOINT_KEY, endpoint);
    try {
      const next = await client.status();
      setStatus(next);
      if (!next.reachable) setError(next.error || "OpenPencil MCP is not reachable.");
      else if (!next.verified) setError("Endpoint responded but did not identify as openpencil-mcp.");
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setChecking(false); }
  };

  const sync = async () => {
    setSyncing(true);
    setError("");
    try {
      const project = await repository.load();
      if (!project) throw new Error("No project is available to sync yet.");
      const nextReport = await client.syncProject(project);
      setReport(nextReport);
      setStatus(await client.status());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setSyncing(false); }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[340px] max-w-[calc(100vw-2rem)]">
      {!open ? (
        <button className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={() => setOpen(true)}>
          <Plug size={13} /> OpenPencil <span className={`size-1.5 rounded-full ${status?.verified ? "bg-[#4ccb88]" : "bg-[#646d78]"}`} />
        </button>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#343a45] bg-[#0f1217]/98 shadow-2xl backdrop-blur-xl">
          <div className="flex h-10 items-center gap-2 border-b border-[#292e36] px-3">
            <Plug size={13} className="text-[#8d99ff]" />
            <div className="flex-1 text-[11px] font-semibold">OpenPencil native bridge</div>
            <button className="grid size-7 place-items-center rounded hover:bg-[#1d222a]" onClick={() => setOpen(false)}><ChevronDown size={13} /></button>
          </div>

          <div className="space-y-3 p-3">
            <div>
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#6f7784]">MCP endpoint</div>
              <input className="field font-mono text-[10px]" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
            </div>

            <div className="flex gap-2">
              <button className="tool-button flex-1" onClick={check} disabled={checking}><RefreshCw size={12} className={checking ? "animate-spin" : ""} /> {checking ? "Checking…" : "Check"}</button>
              <button className="tool-button primary flex-1" onClick={sync} disabled={syncing || !status?.verified}><Send size={12} /> {syncing ? "Syncing…" : "Sync project"}</button>
            </div>

            {status?.verified && capabilities && (
              <div className="rounded-lg border border-[#234132] bg-[#101b16] p-2.5">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-[#72d39d]"><CheckCircle2 size={12} /> Verified openpencil-mcp · {status.tools.length} tools</div>
                <div className="mt-2 flex flex-wrap gap-1">{Object.entries(capabilities).filter(([, enabled]) => enabled).map(([name]) => <span key={name} className="rounded border border-[#294437] bg-[#13251c] px-1.5 py-0.5 text-[8px] text-[#77ad8e]">{name}</span>)}</div>
              </div>
            )}

            {report && (
              <div className="rounded-lg border border-[#29334b] bg-[#111725] p-2.5 text-[10px] text-[#9da9ca]">
                <div className="font-semibold text-[#cbd3f4]">Sync complete</div>
                <div className="mt-1.5 grid grid-cols-2 gap-y-1"><span>DESIGN.md</span><span>{report.designMd}</span><span>Variables</span><span>{report.variables}</span><span>Components</span><span>{report.components}</span><span>Screens</span><span>{report.screens}</span></div>
                {report.warnings.length > 0 && <div className="mt-2 border-t border-[#25304a] pt-2 text-[9px] leading-4 text-[#8e99b6]">{report.warnings.join(" ")}</div>}
              </div>
            )}

            {error && <div className="rounded-lg border border-[#4d292e] bg-[#211215] p-2.5 text-[10px] leading-4 text-[#ee8d98]"><div className="mb-1 flex items-center gap-1.5 font-semibold"><XCircle size={11} /> Connection error</div>{error}</div>}

            {!status?.verified && (
              <div className="rounded-lg border border-[#292e36] bg-[#111419] p-2.5 text-[9px] leading-4 text-[#737c89]">
                <div className="mb-1.5 flex items-center gap-1.5 text-[#9da5b1]"><Terminal size={11} /> Start OpenPencil locally</div>
                <code className="block select-all rounded bg-[#090b0e] px-2 py-1.5 font-mono text-[9px] text-[#aeb6c2]">op start --headless --file design.op</code>
                <div className="mt-1.5">The official CLI serves MCP on port 3100 by default. Your browser connects directly to localhost; no Vercel secret is required.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
