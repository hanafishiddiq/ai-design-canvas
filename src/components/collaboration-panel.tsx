"use client";

import { useEffect, useState } from "react";
import { Cloud, Radio, RefreshCw, Save, Users, X } from "lucide-react";
import { defaultCollaborationSettings, loadCollaborationSettings, saveCollaborationSettings, subscribeCollaborationSettings, type CollaborationSettings } from "@/lib/collaboration-settings";

export function CollaborationPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<CollaborationSettings>(loadCollaborationSettings);
  const [health, setHealth] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => subscribeCollaborationSettings((next) => setSettings(next)), []);

  const patch = <K extends keyof CollaborationSettings>(key: K, value: CollaborationSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = () => {
    saveCollaborationSettings(settings);
    setMessage(settings.mode === "local" ? "Local collaboration enabled." : "Remote relay settings saved.");
  };
  const check = async () => {
    if (settings.mode !== "remote") { setHealth("ok"); setMessage("Local BroadcastChannel mode needs no server."); return; }
    setHealth("checking"); setMessage("");
    try {
      const response = await fetch(`${settings.endpoint.replace(/\/$/, "")}/health`, { headers: settings.token ? { authorization: `Bearer ${settings.token}` } : {} });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { service?: string };
      setHealth("ok"); setMessage(body.service || "Relay reachable.");
    } catch (error) {
      setHealth("error"); setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  if (!open) return <button className="fixed bottom-14 right-4 z-[91] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={() => setOpen(true)}><Users size={13} /> Collaboration</button>;

  return <div className="fixed bottom-14 right-4 z-[91] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#343a45] bg-[#0f1217]/98 shadow-2xl backdrop-blur-xl">
    <div className="flex h-10 items-center gap-2 border-b border-[#292e36] px-3"><Users size={13} className="text-[#8d99ff]" /><div className="flex-1 text-[11px] font-semibold">Collaboration</div><button className="grid size-7 place-items-center rounded hover:bg-[#1d222a]" onClick={() => setOpen(false)}><X size={13} /></button></div>
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        <button className={`tool-button ${settings.mode === "local" ? "primary" : ""}`} onClick={() => patch("mode", "local")}><Radio size={12} /> Local</button>
        <button className={`tool-button ${settings.mode === "remote" ? "primary" : ""}`} onClick={() => patch("mode", "remote")}><Cloud size={12} /> Remote</button>
      </div>
      <label className="block text-[9px] uppercase tracking-wide text-[#6f7784]">Display name<input className="field mt-1 normal-case" value={settings.displayName} onChange={(event) => patch("displayName", event.target.value)} /></label>
      <label className="block text-[9px] uppercase tracking-wide text-[#6f7784]">Room override<input className="field mt-1 normal-case" placeholder="Defaults to project ID" value={settings.roomId} onChange={(event) => patch("roomId", event.target.value)} /></label>
      {settings.mode === "remote" && <>
        <label className="block text-[9px] uppercase tracking-wide text-[#6f7784]">Relay endpoint<input className="field mt-1 font-mono normal-case text-[10px]" value={settings.endpoint} onChange={(event) => patch("endpoint", event.target.value)} /></label>
        <label className="block text-[9px] uppercase tracking-wide text-[#6f7784]">Session token<input className="field mt-1 font-mono normal-case text-[10px]" type="password" value={settings.token || ""} onChange={(event) => patch("token", event.target.value || undefined)} /></label>
      </>}
      <div className="flex gap-2"><button className="tool-button flex-1" onClick={check}><RefreshCw size={11} className={health === "checking" ? "animate-spin" : ""} /> Check</button><button className="tool-button primary flex-1" onClick={save}><Save size={11} /> Save</button></div>
      {message && <div className={`rounded-lg border p-2 text-[9px] leading-4 ${health === "error" ? "border-[#4d292e] bg-[#211215] text-[#ee8d98]" : "border-[#29334b] bg-[#111725] text-[#9da9ca]"}`}>{message}</div>}
      <div className="text-[9px] leading-4 text-[#68717d]">{settings.mode === "local" ? "Local mode synchronizes tabs/windows in the same browser profile." : "Remote mode uses the self-hostable HTTP/SSE relay. The token is session-only and is not written to persistent local storage."}</div>
    </div>
  </div>;
}
