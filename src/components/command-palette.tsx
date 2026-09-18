"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Component, FileSearch, Monitor, Search, X } from "lucide-react";
import { CANVAS_FOCUS_EVENT, filterCommandItems, projectCommandItems, type CommandItem } from "@/lib/commands";
import { applyOperation } from "@/lib/operations";
import { LocalProjectRepository } from "@/lib/storage";
import type { DesignProject } from "@/lib/types";

export function CommandPalette() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [project, setProject] = useState<DesignProject | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void repository.load().then((value) => { if (!cancelled) setProject(value); });
    const unsubscribe = repository.subscribe((value) => setProject(value));
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      cancelled = true;
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [open, repository]);

  const items = useMemo(() => project ? filterCommandItems(projectCommandItems(project), query) : [], [project, query]);


  const choose = async (item: CommandItem) => {
    if (!project || !item.pageId) return;
    const next = applyOperation(project, { type: "project.update", changes: { activePageId: item.pageId } }).project;
    await repository.save(next);
    setProject(next);
    setOpen(false);
    setQuery("");
    const nodeId = item.kind === "node" ? item.nodeId : item.kind === "component" ? item.nodeId : undefined;
    if (nodeId) window.dispatchEvent(new CustomEvent(CANVAS_FOCUS_EVENT, { detail: { pageId: item.pageId, nodeId } }));
  };

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => Math.min(items.length - 1, value + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(0, value - 1));
    }
    if (event.key === "Enter" && items[active]) {
      event.preventDefault();
      void choose(items[active]);
    }
  };

  if (!open) {
    return <button aria-label="Open command palette" title="Command palette (Ctrl/Cmd K)" className="fixed bottom-24 right-[235px] z-[86] flex h-9 items-center gap-2 rounded-lg border border-[#343a45] bg-[#14171d]/95 px-3 text-[11px] text-[#d8dce3] shadow-xl backdrop-blur hover:bg-[#1b1f27]" onClick={() => { setActive(0); setOpen(true); }}><Search size={13} /> Search <kbd>⌘K</kbd></button>;
  }

  return <div className="fixed inset-0 z-[95] flex justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
    <div className="h-fit max-h-[70vh] w-[min(680px,100%)] overflow-hidden rounded-xl border border-[#3a404b] bg-[#0d1015] shadow-2xl">
      <div className="flex h-12 items-center gap-2 border-b border-[#292e36] px-3">
        <Search size={15} className="text-[#8995dc]" />
        <input ref={inputRef} aria-label="Search screens and design nodes" className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#555e69]" placeholder="Search screens, nodes, components…" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onInputKey} />
        <button aria-label="Close command palette" className="tool-button" onClick={() => setOpen(false)}><X size={12} /></button>
      </div>
      <div className="max-h-[calc(70vh-48px)] overflow-auto p-2" role="listbox" aria-label="Search results">
        {items.length ? items.map((item, index) => {
          const Icon = item.kind === "page" ? Monitor : item.kind === "component" ? Component : Box;
          const className = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left " + (index === active ? "bg-[#202635] text-white" : "text-[#a5adb8] hover:bg-[#151920]");
          return <button key={item.id} role="option" aria-selected={index === active} className={className} onMouseEnter={() => setActive(index)} onClick={() => void choose(item)}>
            <Icon size={13} className="shrink-0 text-[#7783c9]" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium">{item.label}</span><span className="mt-0.5 block truncate text-[9px] text-[#68717d]">{item.detail}</span></span>
            <span className="text-[8px] uppercase text-[#59616c]">{item.kind}</span>
          </button>;
        }) : <div className="grid h-36 place-items-center text-center text-[10px] text-[#68717d]"><div><FileSearch size={22} className="mx-auto mb-2 text-[#4d5662]" />No matching project items.</div></div>}
      </div>
    </div>
  </div>;
}
