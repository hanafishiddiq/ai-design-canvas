"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  Box, Boxes, Component, Copy, Download, FileJson, FileText, GitBranch, Group, Layers3,
  Maximize2, Minus, MousePointer2, Play, Plus, Redo2, ScanSearch, ShieldCheck, Sparkles,
  Trash2, Undo2, Ungroup, WandSparkles, X,
} from "lucide-react";
import { auditProject, refineProject } from "@/lib/anti-slop";
import { applyCollaborationEnvelope, BroadcastCollaborationTransport, CollaborationEventTracker, type CollaboratorPresence } from "@/lib/collaboration";
import { createComponentDefinition, instantiateComponent } from "@/lib/components";
import { mergeTokens, parseDesignMd, serializeDesignMd } from "@/lib/design-md";
import { downloadText, exportPageHtml } from "@/lib/export";
import { defaultDirection, foundationAccent, foundations, generateTokens } from "@/lib/foundations";
import { applyAutoLayout, layoutChildren } from "@/lib/layout";
import { OperationHistory, type DesignOperation } from "@/lib/operations";
import { LocalDesignAdapter } from "@/lib/openpencil-adapter";
import { LocalDeterministicProvider } from "@/lib/provider";
import { LocalProjectRepository } from "@/lib/storage";
import type { DesignDirection, DesignNode, DesignPage, DesignProject, DesignTokens, FoundationId, LayoutMode } from "@/lib/types";
import { StudioNodeLayer } from "./studio-node";

const DEFAULT_PROMPT = "A collaborative analytics workspace for product teams with projects, live metrics, recent activity, and account settings.";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const snap = (value: number, step = 4) => Math.round(value / step) * step;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design";
const makeId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

type InspectorTab = "layers" | "inspect" | "design" | "contract" | "audit" | "flow";
type DragState = {
  kind: "page" | "node" | "resize";
  pageId: string;
  nodeId?: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originW?: number;
  originH?: number;
  lastX: number;
  lastY: number;
  lastW?: number;
  lastH?: number;
};

function retokenizeProject(project: DesignProject, oldTokens: DesignTokens, newTokens: DesignTokens) {
  const pairs = Object.keys(oldTokens.colors).map((key) => {
    const typed = key as keyof DesignTokens["colors"];
    return [oldTokens.colors[typed], newTokens.colors[typed]] as const;
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

function StyleSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block text-[10px] text-[#747c88]">{label}<select className="select mt-1 capitalize" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export function StudioWorkspace() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const provider = useMemo(() => new LocalDeterministicProvider(), []);
  const [history, setHistory] = useState<OperationHistory | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contractFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);

  const [project, setProject] = useState<DesignProject | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [projectName, setProjectName] = useState("Signal Workspace");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState<InspectorTab>("layers");
  const [zoom, setZoom] = useState(0.58);
  const [pan, setPan] = useState({ x: 50, y: 40 });
  const [playPageId, setPlayPageId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [collaborationClientId] = useState(() => `client_${Math.random().toString(36).slice(2, 10)}`);
  const [peers, setPeers] = useState<CollaboratorPresence[]>([]);
  const [collaborationError, setCollaborationError] = useState("");
  const projectId = project?.id;
  const activePage = project?.pages.find((page) => page.id === project.activePageId) || project?.pages[0];
  const collaborationTransport = useMemo(
    () => projectId ? new BroadcastCollaborationTransport(projectId, projectId, collaborationClientId) : null,
    [collaborationClientId, projectId],
  );
  const collaborationTracker = useMemo(() => new CollaborationEventTracker(), [projectId]);

  const resetProject = (next: DesignProject) => {
    setHistory(new OperationHistory(next, 150));
    setProject(next);
    setSelectedIds([]);
  };

  useEffect(() => {
    let cancelled = false;
    repository.load().then(async (saved) => {
      const initial = saved || await provider.plan({ prompt: DEFAULT_PROMPT, name: "Signal Workspace", direction: defaultDirection });
      if (cancelled) return;
      setHistory(new OperationHistory(initial, 150));
      setProject(initial);
      setSelectedIds([]);
      setPrompt(initial.prompt);
      setProjectName(initial.name);
    });
    return () => { cancelled = true; };
  }, [provider, repository]);

  useEffect(() => { if (project) void repository.save(project); }, [project, repository]);

  useEffect(() => {
    if (!history) return;
    return repository.subscribe((incoming) => {
      const current = history.current();
      if (incoming.updatedAt === current.updatedAt) return;
      const synced = history.sync({ type: "project.replace", project: incoming });
      setProject(synced);
    });
  }, [history, repository]);

  useEffect(() => {
    if (!collaborationTransport || !history) return;
    return collaborationTransport.connect({
      onOperations: (envelope) => {
        if (!collaborationTracker.accept(envelope)) return;
        try {
          const next = applyCollaborationEnvelope(history.current(), envelope);
          const synced = history.sync({ type: "project.replace", project: next });
          setProject(synced);
          setCollaborationError("");
        } catch (error) {
          setCollaborationError(error instanceof Error ? error.message : String(error));
        }
      },
      onPresence: setPeers,
      onError: (error) => setCollaborationError(error.message),
    });
  }, [collaborationTracker, collaborationTransport, history]);

  useEffect(() => {
    if (!collaborationTransport) return;
    collaborationTransport.updatePresence({
      name: "Designer",
      pageId: activePage?.id,
      nodeIds: selectedIds,
    });
  }, [activePage?.id, collaborationTransport, selectedIds]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const commit = (operation: DesignOperation, label: string) => {
    if (!history) return;
    const before = history.current();
    const next = history.execute(operation, label);
    setProject(next);
    collaborationTransport?.publishOperations(before, [operation]);
  };

  const replaceProject = (next: DesignProject, label: string) => commit({ type: "project.replace", project: next }, label);
  const undo = () => {
    if (!history?.canUndo()) return;
    const before = history.current();
    const result = history.undoDetailed();
    setProject(result.project);
    setSelectedIds([]);
    if (result.operation) collaborationTransport?.publishOperations(before, [result.operation]);
  };
  const redo = () => {
    if (!history?.canRedo()) return;
    const before = history.current();
    const result = history.redoDetailed();
    setProject(result.project);
    setSelectedIds([]);
    if (result.operation) collaborationTransport?.publishOperations(before, [result.operation]);
  };

  const selectedNodes = activePage?.nodes.filter((node) => selectedIds.includes(node.id)) || [];
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const auditIssues = useMemo(() => project ? auditProject(project) : [], [project]);

  const selectPage = (pageId: string) => {
    if (!history) return;
    const next = history.sync({ type: "project.update", changes: { activePageId: pageId } });
    setProject(next);
    setSelectedIds([]);
  };

  const selectNode = (node: DesignNode, additive: boolean) => {
    setSelectedIds((current) => {
      if (!additive) return [node.id];
      return current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id];
    });
    setTab("inspect");
  };

  const updateNode = (nodeId: string, changes: Partial<Omit<DesignNode, "id">>, label = "Edit node") => {
    if (!activePage) return;
    commit({ type: "node.update", pageId: activePage.id, nodeId, changes }, label);
  };

  const updateNodeStyle = (nodeId: string, changes: Partial<DesignNode["style"]>) => {
    if (!activePage) return;
    const node = activePage.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    updateNode(nodeId, { style: { ...node.style, ...changes } }, "Edit appearance");
  };

  const generate = async () => {
    if (!project) return;
    setGenerating(true);
    try {
      const next = await provider.plan({ prompt: prompt.trim() || DEFAULT_PROMPT, name: projectName.trim() || "Untitled product", direction: project.direction });
      resetProject(next);
      setNotice(`Generated ${next.pages.length} structured screens`);
    } finally { setGenerating(false); }
  };

  const changeDirection = <K extends keyof DesignDirection>(key: K, value: DesignDirection[K]) => {
    if (!project) return;
    const next = structuredClone(project);
    const direction = { ...next.direction, [key]: value };
    if (key === "foundation") direction.accent = foundationAccent(value as FoundationId);
    const oldTokens = next.tokens;
    const tokens = generateTokens(direction);
    retokenizeProject(next, oldTokens, tokens);
    next.direction = direction;
    next.tokens = tokens;
    next.designMd = serializeDesignMd(next.name, direction, tokens, parseDesignMd(next.designMd).prose);
    replaceProject(next, `Change ${String(key)}`);
  };

  const fitView = () => {
    if (!project || !canvasRef.current || !project.pages.length) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const minX = Math.min(...project.pages.map((page) => page.x));
    const minY = Math.min(...project.pages.map((page) => page.y));
    const maxX = Math.max(...project.pages.map((page) => page.x + page.width));
    const maxY = Math.max(...project.pages.map((page) => page.y + page.height));
    const width = maxX - minX;
    const height = maxY - minY;
    const nextZoom = clamp(Math.min((rect.width - 100) / width, (rect.height - 100) / height), 0.2, 1.1);
    setZoom(nextZoom);
    setPan({ x: (rect.width - width * nextZoom) / 2 - minX * nextZoom, y: (rect.height - height * nextZoom) / 2 - minY * nextZoom });
  };

  const startNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, node: DesignNode) => {
    if (!activePage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "node", pageId: activePage.id, nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y, lastX: node.x, lastY: node.y };
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>, node: DesignNode) => {
    if (!activePage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "resize", pageId: activePage.id, nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y, originW: node.width, originH: node.height, lastX: node.x, lastY: node.y, lastW: node.width, lastH: node.height };
  };

  const startPageDrag = (event: ReactPointerEvent<HTMLDivElement>, page: DesignPage) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "page", pageId: page.id, startX: event.clientX, startY: event.clientY, originX: page.x, originY: page.y, lastX: page.x, lastY: page.y };
    selectPage(page.id);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (drag.kind === "resize") {
      drag.lastW = Math.max(16, snap((drag.originW || 16) + dx));
      drag.lastH = Math.max(16, snap((drag.originH || 16) + dy));
    } else {
      drag.lastX = snap(drag.originX + dx);
      drag.lastY = snap(drag.originY + dy);
    }
    setProject((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const page = next.pages.find((item) => item.id === drag.pageId);
      if (!page) return current;
      if (drag.kind === "page") { page.x = drag.lastX; page.y = drag.lastY; }
      else {
        const node = page.nodes.find((item) => item.id === drag.nodeId);
        if (!node) return current;
        if (drag.kind === "resize") { node.width = drag.lastW || node.width; node.height = drag.lastH || node.height; }
        else { node.x = drag.lastX; node.y = drag.lastY; }
      }
      return next;
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer may already be released */ }
    dragRef.current = null;
    if (drag.kind === "page") commit({ type: "page.update", pageId: drag.pageId, changes: { x: drag.lastX, y: drag.lastY } }, "Move screen");
    else if (drag.kind === "resize" && drag.nodeId) commit({ type: "node.update", pageId: drag.pageId, nodeId: drag.nodeId, changes: { width: drag.lastW, height: drag.lastH } }, "Resize node");
    else if (drag.nodeId) commit({ type: "node.update", pageId: drag.pageId, nodeId: drag.nodeId, changes: { x: drag.lastX, y: drag.lastY } }, "Move node");
  };

  const canvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { startX: event.clientX, startY: event.clientY, x: pan.x, y: pan.y };
    setSelectedIds([]);
  };
  const canvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) { moveDrag(event); return; }
    const drag = panRef.current;
    if (!drag) return;
    setPan({ x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY });
  };
  const canvasPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) { endDrag(event); return; }
    if (panRef.current) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
      panRef.current = null;
    }
  };
  const canvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((value) => clamp(value * (event.deltaY > 0 ? 0.9 : 1.1), 0.18, 1.6));
  };

  const duplicateSelected = () => {
    if (!activePage || !selectedIds.length) return;
    const originals = activePage.nodes.filter((node) => selectedIds.includes(node.id));
    const idMap = new Map(originals.map((node) => [node.id, makeId("node")]));
    const copies = originals.map((node) => ({
      ...structuredClone(node),
      id: idMap.get(node.id)!,
      x: node.x + 16,
      y: node.y + 16,
      parentId: node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : undefined,
      children: node.children?.map((id) => idMap.get(id)).filter((id): id is string => !!id),
      component: node.component ? { ...node.component, instanceId: makeId("instance") } : undefined,
    }));
    commit({ type: "batch", operations: copies.map((node) => ({ type: "node.insert" as const, pageId: activePage.id, node })) }, "Duplicate selection");
    setSelectedIds(copies.map((node) => node.id));
  };

  const deleteSelected = () => {
    if (!activePage || !selectedIds.length) return;
    commit({ type: "batch", operations: selectedIds.map((nodeId) => ({ type: "node.remove" as const, pageId: activePage.id, nodeId })) }, "Delete selection");
    setSelectedIds([]);
  };

  const createAutoLayoutFrame = (mode: Exclude<LayoutMode, "absolute">) => {
    if (!activePage || selectedNodes.length < 2) { setNotice("Select at least two nodes"); return; }
    if (selectedNodes.some((node) => node.parentId)) { setNotice("Auto-layout grouping currently requires top-level nodes"); return; }
    const minX = Math.min(...selectedNodes.map((node) => node.x));
    const minY = Math.min(...selectedNodes.map((node) => node.y));
    const maxX = Math.max(...selectedNodes.map((node) => node.x + node.width));
    const maxY = Math.max(...selectedNodes.map((node) => node.y + node.height));
    const frameId = makeId("frame");
    let frame: DesignNode = {
      id: frameId, type: "frame", name: mode === "horizontal" ? "Auto row" : "Auto stack",
      x: minX - 12, y: minY - 12, width: maxX - minX + 24, height: maxY - minY + 24,
      style: { padding: 12, borderColor: project?.tokens.colors.border, borderWidth: 1, radius: project?.tokens.radius.md },
      children: selectedNodes.map((node) => node.id),
      layout: { mode, gap: 12, paddingTop: 12, paddingRight: 12, paddingBottom: 12, paddingLeft: 12, align: "start", widthMode: "hug", heightMode: "hug" },
      constraints: { horizontal: "left", vertical: "top" },
    };
    const relative = selectedNodes.map((node) => ({ ...structuredClone(node), x: node.x - frame.x, y: node.y - frame.y, parentId: frame.id, layout: { ...node.layout, mode: node.layout?.mode || "absolute", widthMode: node.layout?.widthMode || "fixed", heightMode: node.layout?.heightMode || "fixed" } }));
    const laidOut = layoutChildren(frame, relative);
    frame = { ...frame, width: laidOut.container.width, height: laidOut.container.height };
    commit({ type: "batch", operations: [
      { type: "node.insert", pageId: activePage.id, node: frame },
      ...laidOut.nodes.map((node) => ({ type: "node.update" as const, pageId: activePage.id, nodeId: node.id, changes: { x: node.x, y: node.y, parentId: frame.id, layout: node.layout } })),
    ] }, `Create ${mode} auto-layout`);
    setSelectedIds([frameId]);
  };

  const detachSelectedFrame = () => {
    if (!activePage || !selectedNode || selectedNode.type !== "frame") return;
    const children = activePage.nodes.filter((node) => node.parentId === selectedNode.id);
    const operations: DesignOperation[] = children.map((node) => ({
      type: "node.update", pageId: activePage.id, nodeId: node.id,
      changes: { x: node.x + selectedNode.x, y: node.y + selectedNode.y, parentId: undefined },
    }));
    operations.push({ type: "node.remove", pageId: activePage.id, nodeId: selectedNode.id });
    commit({ type: "batch", operations }, "Detach auto-layout frame");
    setSelectedIds(children.map((node) => node.id));
  };

  const reflowSelectedFrame = () => {
    if (!project || !activePage || !selectedNode || selectedNode.type !== "frame") return;
    const next = structuredClone(project);
    const page = next.pages.find((item) => item.id === activePage.id)!;
    page.nodes = applyAutoLayout(page.nodes, selectedNode.id);
    replaceProject(next, "Reflow auto-layout");
  };

  const createComponent = () => {
    if (!project || !activePage || !selectedIds.length) return;
    const definition = createComponentDefinition(project, activePage.id, selectedIds, selectedNodes.length === 1 ? selectedNodes[0].name : "Selection component");
    commit({ type: "component.upsert", component: definition }, "Create component");
    setNotice(`Created component: ${definition.name}`);
  };

  const insertComponent = (componentId: string) => {
    if (!project || !activePage) return;
    const definition = project.components[componentId];
    if (!definition) return;
    const nodes = instantiateComponent(definition, 48, 48);
    commit({ type: "batch", operations: nodes.map((node) => ({ type: "node.insert" as const, pageId: activePage.id, node })) }, `Insert ${definition.name}`);
    setSelectedIds(nodes.filter((node) => !node.parentId).map((node) => node.id));
  };

  const applyDesignMdSource = (source: string) => {
    if (!project) return;
    try {
      const parsed = parseDesignMd(source);
      const next = structuredClone(project);
      const direction = { ...next.direction, ...(parsed.direction || {}) } as DesignDirection;
      const tokens = mergeTokens(generateTokens(direction), parsed.tokens);
      retokenizeProject(next, next.tokens, tokens);
      next.direction = direction;
      next.tokens = tokens;
      next.designMd = source;
      replaceProject(next, "Apply DESIGN.md");
      setNotice("Applied DESIGN.md tokens and prose");
    } catch { setNotice("Could not parse DESIGN.md"); }
  };

  const importDesignMd = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    applyDesignMdSource(await file.text());
    event.target.value = "";
  };

  const autoRefine = () => {
    if (!project) return;
    const refined = refineProject(project);
    replaceProject(refined.project, "Anti-slop refinement");
    setNotice(refined.changes.length ? `Applied ${refined.changes.length} safe refinements` : "No safe refinements needed");
  };

  const setPrototypeTarget = (targetPageId: string) => {
    if (!project || !activePage || !selectedNode) return;
    const next = structuredClone(project);
    const page = next.pages.find((item) => item.id === activePage.id)!;
    const node = page.nodes.find((item) => item.id === selectedNode.id)!;
    next.flows = next.flows.filter((flow) => !(flow.fromPageId === page.id && flow.fromNodeId === node.id));
    if (!targetPageId) delete node.action;
    else {
      node.action = { type: "navigate", targetPageId };
      next.flows.push({ id: makeId("flow"), fromPageId: page.id, fromNodeId: node.id, toPageId: targetPageId, label: node.text || node.name });
    }
    replaceProject(next, "Edit prototype flow");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
      if (typing) return;
      if (mod && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, duplicateSelected, redo, undo]);

  const exportOpenPencil = async () => {
    if (!project) return;
    const adapter = new LocalDesignAdapter();
    await adapter.load(project);
    downloadText(`${slug(project.name)}.openpencil-bridge.json`, await adapter.export("openpencil-bridge"), "application/json");
  };

  if (!project || !activePage) return <main className="grid h-screen place-items-center bg-[#090a0c] text-[#9299a6]"><div className="flex items-center gap-2"><Sparkles size={15} /> Initializing schema v5 studio…</div></main>;

  const canUndo = history?.canUndo() || false;
  const canRedo = history?.canRedo() || false;

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#090a0c] text-[#eef0f4]">
      <aside className="flex w-[250px] shrink-0 flex-col border-r border-[#242830] bg-[#0d0f13]">
        <div className="flex h-12 items-center gap-2 border-b border-[#242830] px-3">
          <div className="grid size-7 place-items-center rounded-md border border-[#343a45] bg-[#151820]"><Box size={14} /></div>
          <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">AI Design Canvas</div><div className="text-[10px] text-[#737b88]">Structured Studio · schema v5</div></div>
          <span className="rounded border border-[#2b3039] px-1.5 py-0.5 text-[9px] text-[#858d99]">P1</span>
        </div>
        <div className="panel-section space-y-2">
          <div className="panel-label">Product brief</div>
          <input className="field" value={projectName} aria-label="Project name" onChange={(event) => setProjectName(event.target.value)} />
          <textarea className="textarea min-h-[90px]" value={prompt} aria-label="Product prompt" onChange={(event) => setPrompt(event.target.value)} />
          <button className="tool-button primary w-full" disabled={generating} onClick={generate}><WandSparkles size={13} />{generating ? "Planning…" : "Generate screens"}</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="panel-section !pb-2"><div className="panel-label !mb-0">Screens · {project.pages.length}</div></div>
          <div className="space-y-0.5 px-2 pb-3">{project.pages.map((page, index) => <button key={page.id} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${page.id === activePage.id ? "bg-[#1a1e26] text-white" : "text-[#a2a9b4] hover:bg-[#14171c]"}`} onClick={() => selectPage(page.id)}><span className="grid size-5 place-items-center rounded border border-[#2c313a] text-[9px] text-[#777f8c]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-[12px]">{page.name}</span><span className="text-[9px] text-[#626a76]">{page.nodes.length}</span></button>)}</div>
          <div className="panel-section !pb-2"><div className="panel-label !mb-0">Components · {Object.keys(project.components).length}</div></div>
          <div className="space-y-1 px-2 pb-3">{Object.values(project.components).length === 0 ? <div className="px-2 py-3 text-[10px] text-[#626a76]">Create a component from a canvas selection.</div> : Object.values(project.components).map((component) => <button key={component.id} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[#a2a9b4] hover:bg-[#14171c]" onClick={() => insertComponent(component.id)}><Component size={12} /><span className="truncate text-[11px]">{component.name}</span></button>)}</div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#242830] bg-[#0d0f13] px-2.5">
          <div className="flex items-center gap-1.5">
            <button className="tool-button" disabled={!canUndo} onClick={undo} title="Undo (⌘/Ctrl Z)"><Undo2 size={13} /></button>
            <button className="tool-button" disabled={!canRedo} onClick={redo} title="Redo (⌘/Ctrl Shift Z)"><Redo2 size={13} /></button>
            <div className="mx-1 h-5 w-px bg-[#252a32]" />
            <button className="tool-button" onClick={() => setZoom((value) => clamp(value - .1, .18, 1.6))}><Minus size={13} /></button>
            <button className="tool-button min-w-[58px]" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button className="tool-button" onClick={() => setZoom((value) => clamp(value + .1, .18, 1.6))}><Plus size={13} /></button>
            <button className="tool-button" onClick={fitView}><Maximize2 size={13} /> Fit</button>
            <div className="mx-1 h-5 w-px bg-[#252a32]" />
            <button className="tool-button" disabled={selectedIds.length < 2} onClick={() => createAutoLayoutFrame("horizontal")} title="Wrap selection in horizontal auto-layout"><Group size={13} /> Row</button>
            <button className="tool-button" disabled={selectedIds.length < 2} onClick={() => createAutoLayoutFrame("vertical")}><Group size={13} /> Stack</button>
            <button className="tool-button" disabled={!selectedIds.length} onClick={createComponent}><Component size={13} /> Component</button>
            <button className="tool-button" disabled={!selectedIds.length} onClick={duplicateSelected}><Copy size={13} /></button>
            <button className="tool-button danger" disabled={!selectedIds.length} onClick={deleteSelected}><Trash2 size={13} /></button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[9px] text-[#646d7a]">{selectedIds.length} selected</span>
            <button className="tool-button" onClick={() => downloadText(`${slug(project.name)}.canvas.json`, JSON.stringify(project, null, 2), "application/json")}><FileJson size={13} /> JSON</button>
            <button className="tool-button" onClick={() => downloadText("DESIGN.md", project.designMd)}><FileText size={13} /></button>
            <button className="tool-button primary" onClick={() => setPlayPageId(activePage.id)}><Play size={12} fill="currentColor" /> Play</button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div ref={canvasRef} className="canvas-grid absolute inset-0 overflow-hidden touch-none" onPointerDown={canvasPointerDown} onPointerMove={canvasPointerMove} onPointerUp={canvasPointerUp} onWheel={canvasWheel}>
            <div className="absolute left-0 top-0 h-[2200px] w-[3200px]" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
              <svg className="pointer-events-none absolute left-0 top-0 h-[2200px] w-[3200px] overflow-visible">{project.flows.map((flow) => { const from = project.pages.find((page) => page.id === flow.fromPageId); const to = project.pages.find((page) => page.id === flow.toPageId); if (!from || !to) return null; const x1 = from.x + from.width; const y1 = from.y + from.height / 2; const x2 = to.x; const y2 = to.y + to.height / 2; const cx = (x1 + x2) / 2; return <path key={flow.id} d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`} fill="none" stroke="#59647a" strokeWidth="2" strokeDasharray="6 6" />; })}</svg>
              {project.pages.map((page) => <div key={page.id} className="absolute" style={{ left: page.x, top: page.y, width: page.width, height: page.height }}>
                <div className={`absolute -top-7 left-0 flex h-6 items-center gap-2 rounded px-1.5 text-[11px] ${page.id === activePage.id ? "bg-[#252b37] text-white" : "text-[#8c94a0]"}`} onPointerDown={(event) => startPageDrag(event, page)} onPointerMove={moveDrag} onPointerUp={endDrag}><span className="size-1.5 rounded-full" style={{ background: page.id === activePage.id ? project.tokens.colors.accent : "#515866" }} />{page.name}<span className="text-[9px] text-[#646c78]">{page.route}</span></div>
                <div className={`relative overflow-visible shadow-[0_20px_80px_rgba(0,0,0,.34)] ${page.id === activePage.id ? "ring-2 ring-[#6774b8]" : "ring-1 ring-[#323844]"}`} style={{ width: page.width, height: page.height, background: page.background, fontFamily: project.tokens.typography.fontFamily }} onPointerDown={() => selectPage(page.id)}>
                  <StudioNodeLayer allNodes={page.nodes} selectedIds={page.id === activePage.id ? selectedIds : []} onSelect={selectNode} onDragStart={startNodeDrag} onResizeStart={startResize} />
                </div>
              </div>)}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[#252b34] bg-[#0d1015]/90 px-2.5 py-1.5 text-[10px] text-[#727a87] shadow-lg backdrop-blur">Shift-click multi-select · drag to move · resize selected node · ⌘/Ctrl-Z undo · ⌘/Ctrl-D duplicate</div>
        </div>
      </section>

      <aside className="flex w-[324px] shrink-0 flex-col border-l border-[#242830] bg-[#0d0f13]">
        <div className="grid h-12 shrink-0 grid-cols-6 border-b border-[#242830] p-1.5">{([['layers', Layers3], ['inspect', MousePointer2], ['design', Boxes], ['contract', FileText], ['audit', ShieldCheck], ['flow', GitBranch]] as const).map(([id, Icon]) => <button key={id} title={id} className={`grid place-items-center rounded-md ${tab === id ? "bg-[#20242c] text-white" : "text-[#69717e] hover:text-[#b5bbc5]"}`} onClick={() => setTab(id)}><Icon size={14} /></button>)}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "layers" && <><div className="panel-section"><div className="panel-label">Layers · {activePage.name}</div><div className="text-[10px] text-[#707885]">Semantic hierarchy, frames and component instances.</div></div><div className="space-y-0.5 p-2">{activePage.nodes.map((node) => <button key={node.id} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] ${selectedIds.includes(node.id) ? "bg-[#202530] text-white" : "text-[#8f97a4] hover:bg-[#151820]"}`} style={{ paddingLeft: node.parentId ? 24 : 8 }} onClick={(event) => selectNode(node, event.shiftKey || event.metaKey || event.ctrlKey)}><span className="text-[9px] text-[#5f6875]">{node.type}</span><span className="min-w-0 flex-1 truncate">{node.name}</span>{node.component && <Component size={10} className="text-[#7c8cff]" />}</button>)}</div></>}

          {tab === "inspect" && <><div className="panel-section"><div className="panel-label">Selection</div>{selectedNode ? <><div className="text-[13px] font-semibold">{selectedNode.name}</div><div className="mt-1 text-[10px] text-[#757d89]">{selectedNode.type} · {selectedNode.id}</div></> : <div className="text-[12px] text-[#717987]">{selectedIds.length > 1 ? `${selectedIds.length} nodes selected` : "Select a node on the canvas."}</div>}</div>{selectedNode && <>
            {selectedNode.text !== undefined && <div className="panel-section"><div className="panel-label">Content</div><textarea className="textarea min-h-[70px]" value={selectedNode.text} onChange={(event) => updateNode(selectedNode.id, { text: event.target.value }, "Edit text")} /></div>}
            <div className="panel-section"><div className="panel-label">Geometry</div><div className="grid grid-cols-2 gap-2">{(["x", "y", "width", "height"] as const).map((key) => <label key={key} className="text-[10px] text-[#747c88]">{key.toUpperCase()}<input className="field mt-1" type="number" value={Math.round(selectedNode[key])} onChange={(event) => updateNode(selectedNode.id, { [key]: Number(event.target.value) }, `Edit ${key}`)} /></label>)}</div></div>
            <div className="panel-section"><div className="panel-label">Appearance</div><div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-[#747c88]">Radius<input className="field mt-1" type="number" value={selectedNode.style.radius ?? 0} onChange={(event) => updateNodeStyle(selectedNode.id, { radius: Number(event.target.value) })} /></label><label className="text-[10px] text-[#747c88]">Padding<input className="field mt-1" type="number" value={selectedNode.style.padding ?? 0} onChange={(event) => updateNodeStyle(selectedNode.id, { padding: Number(event.target.value) })} /></label><label className="col-span-2 text-[10px] text-[#747c88]">Background<input className="field mt-1 font-mono text-[11px]" value={selectedNode.style.background ?? ""} onChange={(event) => updateNodeStyle(selectedNode.id, { background: event.target.value || undefined })} /></label></div></div>
            <div className="panel-section"><div className="panel-label">Responsive constraints</div><div className="grid grid-cols-2 gap-2"><StyleSelect label="Horizontal" value={selectedNode.constraints?.horizontal || "left"} options={["left","right","left-right","center","scale"]} onChange={(value) => updateNode(selectedNode.id, { constraints: { ...selectedNode.constraints, horizontal: value as NonNullable<DesignNode["constraints"]>["horizontal"] } }, "Edit constraints")} /><StyleSelect label="Vertical" value={selectedNode.constraints?.vertical || "top"} options={["top","bottom","top-bottom","center","scale"]} onChange={(value) => updateNode(selectedNode.id, { constraints: { ...selectedNode.constraints, vertical: value as NonNullable<DesignNode["constraints"]>["vertical"] } }, "Edit constraints")} /></div></div>
            {selectedNode.type === "frame" && <div className="panel-section"><div className="panel-label">Auto-layout</div><div className="space-y-2"><StyleSelect label="Direction" value={selectedNode.layout?.mode || "absolute"} options={["absolute","horizontal","vertical"]} onChange={(value) => updateNode(selectedNode.id, { layout: { ...selectedNode.layout, mode: value as LayoutMode } }, "Edit layout")} /><label className="block text-[10px] text-[#747c88]">Gap<input className="field mt-1" type="number" value={selectedNode.layout?.gap ?? 0} onChange={(event) => updateNode(selectedNode.id, { layout: { ...selectedNode.layout, mode: selectedNode.layout?.mode || "vertical", gap: Number(event.target.value) } }, "Edit layout gap")} /></label><button className="tool-button w-full" onClick={reflowSelectedFrame}><Group size={12} /> Reflow children</button><button className="tool-button w-full" onClick={detachSelectedFrame}><Ungroup size={12} /> Detach frame</button></div></div>}
            <div className="panel-section"><div className="panel-label">Prototype action</div><select className="select" value={selectedNode.action?.targetPageId || ""} onChange={(event) => setPrototypeTarget(event.target.value)}><option value="">No navigation</option>{project.pages.filter((page) => page.id !== activePage.id).map((page) => <option key={page.id} value={page.id}>Navigate → {page.name}</option>)}</select></div>
          </>}</>}

          {tab === "design" && <><div className="panel-section"><div className="panel-label">Foundation</div><select className="select" value={project.direction.foundation} onChange={(event) => changeDirection("foundation", event.target.value as DesignDirection["foundation"])}>{Object.entries(foundations).map(([id, value]) => <option key={id} value={id}>{value.name}</option>)}</select><p className="mb-0 mt-2 text-[11px] leading-4 text-[#727a86]">{foundations[project.direction.foundation].description}</p></div><div className="panel-section space-y-3"><div className="panel-label">Style mixer</div><StyleSelect label="Treatment" value={project.direction.treatment} options={["precision","editorial","technical","quiet","expressive"]} onChange={(value) => changeDirection("treatment", value as DesignDirection["treatment"])} /><StyleSelect label="Density" value={project.direction.density} options={["compact","balanced","comfortable"]} onChange={(value) => changeDirection("density", value as DesignDirection["density"])} /><StyleSelect label="Radius" value={project.direction.radius} options={["sharp","soft","rounded"]} onChange={(value) => changeDirection("radius", value as DesignDirection["radius"])} /><StyleSelect label="Theme" value={project.direction.theme} options={["dark","light"]} onChange={(value) => changeDirection("theme", value as DesignDirection["theme"])} /></div></>}

          {tab === "contract" && <><div className="panel-section"><div className="panel-label">DESIGN.md</div><div className="text-[11px] text-[#737b87]">Portable intent remains independent from canvas geometry.</div></div><div className="p-3"><textarea className="textarea min-h-[430px] font-mono text-[10px] leading-[1.55]" value={project.designMd} onChange={(event) => commit({ type: "project.update", changes: { designMd: event.target.value } }, "Edit DESIGN.md")} /></div><div className="panel-section flex flex-wrap gap-1.5"><button className="tool-button" onClick={() => applyDesignMdSource(project.designMd)}><ScanSearch size={12} /> Apply</button><button className="tool-button" onClick={() => contractFileRef.current?.click()}><Download size={12} className="rotate-180" /> Import</button><button className="tool-button" onClick={() => downloadText("DESIGN.md", project.designMd)}><Download size={12} /> Export</button><input ref={contractFileRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={importDesignMd} /></div></>}

          {tab === "audit" && <><div className="panel-section"><div className="flex items-center justify-between"><div><div className="panel-label">Anti-slop audit</div><div className="text-[11px] text-[#737b87]">Deterministic design-quality checks.</div></div><span className="rounded border border-[#303640] px-2 py-1 text-[10px]">{auditIssues.length}</span></div><button className="tool-button primary mt-3 w-full" onClick={autoRefine}><ShieldCheck size={13} /> Auto refine</button></div><div className="space-y-2 p-3">{auditIssues.length === 0 ? <div className="rounded-lg border border-[#25332d] bg-[#101a16] p-3 text-[11px] text-[#72c99b]">No rules currently firing.</div> : auditIssues.map((issue) => <button key={issue.id} className="w-full rounded-lg border border-[#292e36] bg-[#111419] p-3 text-left" onClick={() => { selectPage(issue.pageId); setSelectedIds(issue.nodeId ? [issue.nodeId] : []); }}><div className="text-[11px] font-semibold">{issue.rule}</div><div className="mt-1 text-[10px] leading-4 text-[#858d99]">{issue.message}</div></button>)}</div></>}

          {tab === "flow" && <><div className="panel-section"><div className="panel-label">Prototype & engine</div><div className="text-[11px] leading-4 text-[#737b87]">Flows are first-class project data. The same operation model is exposed to local and HTTP/OpenPencil adapters.</div></div><div className="space-y-2 p-3">{project.flows.map((flow) => { const from = project.pages.find((page) => page.id === flow.fromPageId); const to = project.pages.find((page) => page.id === flow.toPageId); return <div key={flow.id} className="rounded-lg border border-[#292e36] p-3 text-[11px]">{from?.name} → {to?.name}<div className="mt-1 text-[9px] text-[#69717d]">{flow.label}</div></div>; })}</div><div className="panel-section space-y-2"><button className="tool-button w-full" onClick={exportOpenPencil}><FileJson size={12} /> OpenPencil bridge v2</button><button className="tool-button w-full" onClick={() => downloadText(`${slug(activePage.name)}.html`, exportPageHtml(project, activePage), "text/html")}><Download size={12} /> Selected screen HTML</button></div></>}
        </div>
      </aside>

      {playPageId && (() => { const page = project.pages.find((item) => item.id === playPageId) || project.pages[0]; return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-8 backdrop-blur-sm"><div className="max-h-full max-w-full overflow-auto rounded-xl border border-[#303640] bg-[#0c0e12] shadow-2xl"><div className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-[#292e36] bg-[#101318]/95 px-3"><div className="flex items-center gap-2 text-[11px]"><Play size={12} fill="currentColor" /> Prototype · {page.name}</div><button className="tool-button" onClick={() => setPlayPageId(null)}><X size={13} /></button></div><div className="relative overflow-hidden" style={{ width: page.width, height: page.height, background: page.background, fontFamily: project.tokens.typography.fontFamily }}><StudioNodeLayer allNodes={page.nodes} selectedIds={[]} interactive onAction={(node) => { if (node.action) setPlayPageId(node.action.targetPageId); }} /></div></div></div>; })()}
      {notice && <div className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-lg border border-[#343a45] bg-[#171a20] px-3 py-2 text-[11px] text-[#dce0e6] shadow-xl">{notice}</div>}
    </main>
  );
}
