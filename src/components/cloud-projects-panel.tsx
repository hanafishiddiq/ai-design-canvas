"use client";

import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudDownload, CloudUpload, LogIn, LogOut, RefreshCw, Trash2, UserPlus, Users, X } from "lucide-react";
import { CloudConflictError, CloudProjectClient, type CloudHealth, type CloudMember, type CloudProjectSummary, type CloudProjectRole } from "@/lib/cloud";
import { clearCloudSession, loadCloudSession, saveCloudEndpoint, saveCloudSession, subscribeCloudSession } from "@/lib/cloud-settings";
import { LocalProjectRepository } from "@/lib/storage";
import type { DesignProject } from "@/lib/types";

export function CloudProjectsPanel() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(loadCloudSession);
  const [endpoint, setEndpoint] = useState(session.endpoint);
  const [health, setHealth] = useState<CloudHealth | null>(null);
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [members, setMembers] = useState<CloudMember[]>([]);
  const [activeSummary, setActiveSummary] = useState<CloudProjectSummary | null>(null);
  const [localProject, setLocalProject] = useState<DesignProject | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Extract<CloudProjectRole, "editor" | "viewer">>("editor");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const client = useMemo(() => new CloudProjectClient(endpoint, session.token), [endpoint, session.token]);
  useEffect(() => subscribeCloudSession((next) => { setSession(next); setEndpoint(next.endpoint); }), []);

  const refresh = async () => {
    setBusy(true); setMessage("");
    try {
      const nextHealth = await new CloudProjectClient(endpoint).health();
      setHealth(nextHealth);
      saveCloudEndpoint(endpoint);
      setLocalProject(await repository.load());
      if (session.token) {
        const nextProjects = await client.listProjects();
        setProjects(nextProjects);
        const currentId = (await repository.load())?.id;
        const current = nextProjects.find((project) => project.id === currentId) || null;
        setActiveSummary(current);
        if (current) setMembers(await client.listMembers(current.id));
        else setMembers([]);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const show = async () => { setOpen(true); await refresh(); };

  const authenticate = async (register: boolean) => {
    setBusy(true); setMessage("");
    try {
      const next = register ? await new CloudProjectClient(endpoint).register(name, email, password) : await new CloudProjectClient(endpoint).login(email, password);
      saveCloudSession(endpoint, next);
      setSession({ endpoint, token: next.token, user: next.user, expiresAt: next.expiresAt });
      setPassword("");
      setMessage(`Signed in as ${next.user.name}.`);
      const authed = new CloudProjectClient(endpoint, next.token);
      setProjects(await authed.listProjects());
      setLocalProject(await repository.load());
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const logout = () => { clearCloudSession(); setSession({ endpoint }); setProjects([]); setMembers([]); setActiveSummary(null); setMessage("Signed out."); };

  const pushLocal = async () => {
    const project = await repository.load();
    if (!project || !session.token) return;
    setBusy(true); setMessage("");
    try {
      const existing = projects.find((item) => item.id === project.id);
      const record = existing ? await client.saveProject(project, existing.revision) : await client.createProject(project);
      setMessage(existing ? `Saved cloud revision ${record.summary.revision}.` : "Created cloud project.");
      const next = await client.listProjects(); setProjects(next); setActiveSummary(next.find((item) => item.id === project.id) || null);
    } catch (error) {
      setMessage(error instanceof CloudConflictError ? `Conflict: cloud is revision ${error.current.revision}. Open cloud copy or refresh before overwriting.` : error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };
  const openCloud = async (summary: CloudProjectSummary) => {
    if (!session.token) return;
    setBusy(true); setMessage("");
    try {
      const record = await client.getProject(summary.id);
      if (typeof window !== "undefined" && !window.confirm(`Replace the local project with cloud revision ${record.summary.revision} of "${record.summary.name}"? A local checkpoint is preserved automatically.`)) return;
      await repository.save(record.project);
      setActiveSummary(record.summary);
      setMembers(await client.listMembers(summary.id));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const deleteCloud = async (summary: CloudProjectSummary) => {
    if (!session.token || summary.role !== "owner") return;
    if (typeof window !== "undefined" && !window.confirm(`Delete cloud project "${summary.name}"? Local/exported copies are unaffected.`)) return;
    setBusy(true);
    try { await client.deleteProject(summary.id); setProjects(await client.listProjects()); setMessage("Cloud project deleted."); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const share = async () => {
    if (!activeSummary || activeSummary.role !== "owner") return;
    setBusy(true);
    try { await client.addMember(activeSummary.id, memberEmail, memberRole); setMembers(await client.listMembers(activeSummary.id)); setMemberEmail(""); setMessage("Member access updated."); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  if (!open) return <button className="fixed bottom-14 right-[150px] z-[89] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={show}><Cloud size={13} /> Cloud</button>;

  return <div className="fixed inset-0 z-[86] grid place-items-center bg-black/65 p-6 backdrop-blur-sm">
    <div className="flex h-[min(760px,calc(100vh-3rem))] w-[min(1050px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#343a45] bg-[#0d1015] shadow-2xl">
      <div className="flex h-12 items-center gap-2 border-b border-[#292e36] px-3"><Cloud size={14} className="text-[#8d99ff]" /><div className="flex-1"><div className="text-[12px] font-semibold">Optional cloud projects</div><div className="text-[9px] text-[#6e7784]">Self-hostable users, roles, revisions and snapshots. Local/export ownership remains intact.</div></div><button className="tool-button" onClick={refresh}><RefreshCw size={12} className={busy ? "animate-spin" : ""} /></button><button className="tool-button" onClick={() => setOpen(false)}><X size={12} /></button></div>
      {message && <div className="border-b border-[#292e36] px-4 py-2 text-[10px] text-[#9da9ca]">{message}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-[330px_1fr]">
        <aside className="min-h-0 overflow-auto border-r border-[#242830] p-3">
          <div className="panel-label">Server</div><input className="field font-mono text-[10px]" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
          <div className="mt-2 text-[9px] text-[#68717d]">{health ? `${health.service} · ${health.projects} project(s)` : "Use Check/Refresh to probe the server."}</div>
          {!session.token ? <div className="mt-5 space-y-2"><div className="panel-label">Account</div><input className="field" placeholder="Name (for registration)" value={name} onChange={(event) => setName(event.target.value)} /><input className="field" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} /><input className="field" type="password" placeholder="Password (12+ chars)" value={password} onChange={(event) => setPassword(event.target.value)} /><div className="grid grid-cols-2 gap-2"><button className="tool-button primary" disabled={busy} onClick={() => void authenticate(false)}><LogIn size={11} /> Sign in</button><button className="tool-button" disabled={busy || health?.registrationAllowed === false} onClick={() => void authenticate(true)}><UserPlus size={11} /> Register</button></div></div> : <div className="mt-5"><div className="panel-label">Signed in</div><div className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="text-[11px] font-semibold">{session.user?.name}</div><div className="mt-1 text-[9px] text-[#68717d]">{session.user?.email}</div></div><button className="tool-button mt-2 w-full" onClick={logout}><LogOut size={11} /> Sign out</button></div>}
          {session.token && localProject && <div className="mt-5"><div className="panel-label">Current local project</div><div className="rounded-lg border border-[#292e36] p-3"><div className="truncate text-[11px] font-semibold">{localProject.name}</div><div className="mt-1 font-mono text-[8px] text-[#68717d]">{localProject.id}</div><button className="tool-button primary mt-3 w-full" disabled={busy} onClick={() => void pushLocal()}><CloudUpload size={11} /> {projects.some((item) => item.id === localProject.id) ? "Save revision" : "Create in cloud"}</button></div></div>}
        </aside>
        <section className="min-h-0 overflow-auto p-4">
          <div className="panel-label">Projects</div>
          {!session.token ? <div className="rounded-lg border border-dashed border-[#303640] p-6 text-center text-[10px] text-[#68717d]">Sign in to list optional cloud copies.</div> : <div className="space-y-2">{projects.map((project) => <div key={project.id} className={`rounded-xl border p-3 ${activeSummary?.id === project.id ? "border-[#4c5689] bg-[#151926]" : "border-[#292e36] bg-[#111419]"}`}><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{project.name}</div><div className="mt-1 text-[9px] text-[#68717d]">{project.role} · revision {project.revision} · {project.members} member(s)</div></div><button className="tool-button" onClick={() => void openCloud(project)}><CloudDownload size={11} /> Open</button>{project.role === "owner" && <button className="tool-button danger" onClick={() => void deleteCloud(project)}><Trash2 size={11} /></button>}</div></div>)}</div>}
          {activeSummary?.role === "owner" && <div className="mt-6"><div className="panel-label">Project access</div><div className="flex gap-2"><input className="field" type="email" placeholder="Existing user email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} /><select className="select !w-[110px]" value={memberRole} onChange={(event) => setMemberRole(event.target.value as typeof memberRole)}><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className="tool-button primary" onClick={() => void share()}><Users size={11} /> Add</button></div><div className="mt-2 space-y-1">{members.map((member) => <div key={member.user.id} className="flex items-center gap-2 rounded border border-[#292e36] px-2 py-1.5 text-[9px]"><span className="min-w-0 flex-1 truncate">{member.user.name} · {member.user.email}</span><span className="text-[#79828e]">{member.role}</span>{member.role !== "owner" && <button className="text-[#d27f88]" onClick={async () => { await client.removeMember(activeSummary.id, member.user.id); setMembers(await client.listMembers(activeSummary.id)); }}>Remove</button>}</div>)}</div></div>}
        </section>
      </div>
    </div>
  </div>;
}
