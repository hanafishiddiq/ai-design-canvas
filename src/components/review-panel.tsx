"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, History, MessageSquare, RefreshCw, Reply, RotateCcw, Trash2, X } from "lucide-react";
import { addReviewThread, removeReviewThread, replyToReviewThread, reviewSummary, setReviewStatus, setReviewThreadResolved } from "@/lib/review";
import { LocalProjectRepository, type ProjectCheckpoint } from "@/lib/storage";
import type { DesignProject, ReviewStatus } from "@/lib/types";

const statusLabels: Record<ReviewStatus, string> = {
  draft: "Draft",
  "in-review": "In review",
  "changes-requested": "Changes requested",
  approved: "Approved",
};

export function ReviewPanel() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<DesignProject | null>(null);
  const [checkpoints, setCheckpoints] = useState<ProjectCheckpoint[]>([]);
  const [pageId, setPageId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [author, setAuthor] = useState("Reviewer");
  const [message, setMessage] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const refresh = async () => {
    const next = await repository.load();
    const history = await repository.listCheckpoints();
    setProject(next);
    setCheckpoints(history);
    if (next) {
      const active = next.pages.find((page) => page.id === next.activePageId) || next.pages[0];
      setPageId((current) => next.pages.some((page) => page.id === current) ? current : active?.id || "");
    }
  };
  const show = async () => { setOpen(true); setError(""); await refresh(); };
  const save = async (next: DesignProject) => { await repository.save(next); setProject(next); };
  const activePage = project?.pages.find((page) => page.id === pageId);
  const summary = project ? reviewSummary(project) : null;

  const add = async () => {
    if (!project || !pageId) return;
    try {
      await save(addReviewThread(project, { pageId, nodeId: nodeId || undefined, author, message }));
      setMessage(""); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const changeStatus = async (status: ReviewStatus) => { if (project) await save(setReviewStatus(project, status)); };
  const resolve = async (threadId: string, value: boolean) => { if (project) await save(setReviewThreadResolved(project, threadId, value)); };
  const remove = async (threadId: string) => { if (project) await save(removeReviewThread(project, threadId)); };
  const reply = async (threadId: string) => {
    if (!project) return;
    const text = replyDrafts[threadId] || "";
    try {
      await save(replyToReviewThread(project, threadId, text, author));
      setReplyDrafts((current) => ({ ...current, [threadId]: "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const restore = async (id: string) => {
    await repository.restoreCheckpoint(id);
    window.location.reload();
  };

  if (!open) return <button className="fixed bottom-4 left-[278px] z-[89] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={show}><MessageSquare size={13} /> Review</button>;

  return <div className="fixed inset-0 z-[86] grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
    <div className="flex h-[min(790px,calc(100vh-3rem))] w-[min(1120px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#292e36] px-3">
        <MessageSquare size={14} className="text-[#8d99ff]" />
        <div className="flex-1"><div className="text-[12px] font-semibold">Review & versions</div><div className="text-[9px] text-[#6e7784]">Portable review threads and local recovery checkpoints.</div></div>
        <select className="select !w-[170px]" value={project?.review.status || "draft"} onChange={(event) => void changeStatus(event.target.value as ReviewStatus)} disabled={!project}>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="tool-button" onClick={refresh}><RefreshCw size={12}/></button>
        <button className="tool-button" onClick={() => setOpen(false)}><X size={12}/></button>
      </div>
      {error && <div className="border-b border-[#4b292e] bg-[#211215] px-4 py-2 text-[10px] text-[#e78c96]">{error}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_330px]">
        <section className="min-h-0 overflow-auto p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="text-[18px] font-semibold">{summary?.open ?? 0}</div><div className="text-[8px] uppercase text-[#68717d]">open threads</div></div>
            <div className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="text-[18px] font-semibold">{summary?.resolved ?? 0}</div><div className="text-[8px] uppercase text-[#68717d]">resolved</div></div>
            <div className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="truncate text-[12px] font-semibold">{summary ? statusLabels[summary.status] : "—"}</div><div className="text-[8px] uppercase text-[#68717d]">review status</div></div>
          </div>

          <div className="mt-4 rounded-xl border border-[#292e36] bg-[#111419] p-3">
            <div className="panel-label">New thread</div>
            <div className="grid grid-cols-2 gap-2"><select className="select" value={pageId} onChange={(event) => { setPageId(event.target.value); setNodeId(""); }}>{project?.pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}</select><select className="select" value={nodeId} onChange={(event) => setNodeId(event.target.value)}><option value="">Whole screen</option>{activePage?.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></div>
            <div className="mt-2 grid grid-cols-[150px_1fr] gap-2"><input className="field" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Reviewer"/><textarea className="textarea min-h-[72px]" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What should change, and why?"/></div>
            <button className="tool-button primary mt-2" onClick={() => void add()} disabled={!message.trim() || !project}><MessageSquare size={11}/> Add review thread</button>
          </div>

          <div className="mt-4 space-y-2">{project?.review.threads.length ? [...project.review.threads].reverse().map((thread) => {
            const page = project.pages.find((item) => item.id === thread.pageId);
            const node = page?.nodes.find((item) => item.id === thread.nodeId);
            return <article key={thread.id} className={`rounded-xl border p-3 ${thread.resolved ? "border-[#294334] bg-[#101a15]" : "border-[#292e36] bg-[#111419]"}`}>
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[9px] text-[#6f7884]"><span className="font-semibold text-[#aeb5c0]">{thread.author}</span><span>·</span><span>{page?.name || thread.pageId}{node ? ` / ${node.name}` : ""}</span></div><p className="mb-0 mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#c0c6cf]">{thread.message}</p></div><button className="tool-button !h-7" onClick={() => void resolve(thread.id, !thread.resolved)}>{thread.resolved ? <RotateCcw size={10}/> : <Check size={10}/>} {thread.resolved ? "Reopen" : "Resolve"}</button><button className="grid size-7 place-items-center rounded text-[#6f7784] hover:bg-[#2a171a] hover:text-[#e88893]" onClick={() => void remove(thread.id)}><Trash2 size={11}/></button></div>
              {thread.replies.length > 0 && <div className="mt-3 space-y-1.5 border-l border-[#303640] pl-3">{thread.replies.map((item) => <div key={item.id}><div className="text-[9px] font-semibold text-[#88919e]">{item.author}</div><div className="text-[10px] leading-4 text-[#a7afbb]">{item.message}</div></div>)}</div>}
              <div className="mt-3 flex gap-1.5"><input className="field" value={replyDrafts[thread.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))} placeholder="Reply…"/><button className="tool-button" disabled={!replyDrafts[thread.id]?.trim()} onClick={() => void reply(thread.id)}><Reply size={10}/> Reply</button></div>
            </article>;
          }) : <div className="rounded-xl border border-dashed border-[#303640] p-8 text-center text-[10px] text-[#68717d]">No review threads yet.</div>}</div>
        </section>

        <aside className="min-h-0 overflow-auto border-l border-[#242830] p-3">
          <div className="flex items-center gap-2"><History size={13} className="text-[#8c96a3]"/><div className="panel-label !mb-0">Recovery checkpoints</div></div>
          <p className="mt-2 text-[9px] leading-4 text-[#68717d]">Checkpoints are automatic local snapshots. Restoring one reloads the Studio with that durable version.</p>
          <div className="mt-3 space-y-1.5">{checkpoints.length ? checkpoints.map((checkpoint) => <div key={checkpoint.id} className="rounded-lg border border-[#292e36] bg-[#111419] p-2.5"><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-medium">{checkpoint.project.name}</div><div className="mt-1 text-[8px] text-[#68717d]">{new Date(checkpoint.createdAt).toLocaleString()} · schema v{checkpoint.project.version}</div></div><button className="tool-button !h-7" onClick={() => void restore(checkpoint.id)}><RotateCcw size={10}/> Restore</button></div></div>) : <div className="rounded-lg border border-dashed border-[#303640] p-4 text-center text-[9px] text-[#68717d]">No checkpoints yet. They appear as the project is edited and saved.</div>}</div>
          {project?.review.status === "approved" && <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#294334] bg-[#101a15] p-3 text-[10px] text-[#78c999]"><CheckCircle2 size={13}/> This design is marked approved.</div>}
        </aside>
      </div>
    </div>
  </div>;
}
