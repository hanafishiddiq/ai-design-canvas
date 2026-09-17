"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  Box, Download, FileJson, FileText, GitBranch, Maximize2, Minus, MousePointer2,
  Play, Plus, ScanSearch, ShieldCheck, SlidersHorizontal, Sparkles, WandSparkles, X,
} from "lucide-react";
import { auditProject, refineProject } from "@/lib/anti-slop";
import { mergeTokens, parseDesignMd, serializeDesignMd } from "@/lib/design-md";
import { downloadText, exportPageHtml } from "@/lib/export";
import { defaultDirection, foundationAccent, foundations, generateTokens } from "@/lib/foundations";
import { LocalDesignAdapter } from "@/lib/openpencil-adapter";
import { LocalDeterministicProvider } from "@/lib/provider";
import { LocalProjectRepository } from "@/lib/storage";
import type { DesignDirection, DesignNode, DesignPage, DesignProject, DesignTokens, FoundationId } from "@/lib/types";

const DEFAULT_PROMPT = "A collaborative analytics workspace for product teams with projects, live metrics, recent activity, and account settings.";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design";

type InspectorTab = "inspect" | "design" | "contract" | "audit" | "flow";
type DragState = { kind: "page" | "node"; pageId: string; nodeId?: string; startX: number; startY: number; originX: number; originY: number };

function nodeCss(node: DesignNode, selected = false): CSSProperties {
  const style = node.style;
  return {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    background: style.background,
    color: style.color,
    border: style.borderColor ? `${style.borderWidth || 1}px solid ${style.borderColor}` : undefined,
    borderRadius: style.radius,
    padding: style.padding,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    opacity: style.opacity,
    display: "flex",
    alignItems: node.type === "text" ? "flex-start" : "center",
    justifyContent: style.align === "center" ? "center" : "flex-start",
    textAlign: style.align,
    whiteSpace: "pre-line",
    lineHeight: 1.35,
    overflow: "hidden",
    userSelect: "none",
    boxSizing: "border-box",
    outline: selected ? "2px solid #7c8cff" : undefined,
    outlineOffset: selected ? 2 : undefined,
    cursor: selected ? "move" : "default",
  };
}

function retokenizeProject(project: DesignProject, oldTokens: DesignTokens, newTokens: DesignTokens) {
  const colorPairs = Object.keys(oldTokens.colors).map((key) => {
    const typedKey = key as keyof DesignTokens["colors"];
    return [oldTokens.colors[typedKey], newTokens.colors[typedKey]] as const;
  });
  const replaceColor = (value?: string) => colorPairs.find(([from]) => from === value)?.[1] || value;
  for (const page of project.pages) {
    page.background = replaceColor(page.background) || page.background;
    for (const node of page.nodes) {
      node.style.background = replaceColor(node.style.background);
      node.style.color = replaceColor(node.style.color);
      node.style.borderColor = replaceColor(node.style.borderColor);
    }
  }
}

function NodeView({ node, selected, onPointerDown, onPointerMove, onPointerUp, onAction }: {
  node: DesignNode;
  selected?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onAction?: () => void;
}) {
  return (
    <div
      data-node={node.id}
      title={node.name}
      style={nodeCss(node, selected)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={(event) => { if (node.action && onAction) { event.stopPropagation(); onAction(); } }}
    >
      {node.text || (node.type === "card" ? "" : node.name)}
    </div>
  );
}

function PlayPreview({ project, pageId, onNavigate }: { project: DesignProject; pageId: string; onNavigate: (pageId: string) => void }) {
  const page = project.pages.find((item) => item.id === pageId) || project.pages[0];
  return (
    <div style={{ position: "relative", width: page.width, height: page.height, background: page.background, fontFamily: project.tokens.typography.fontFamily, overflow: "hidden" }}>
      {page.nodes.map((node) => (
        <NodeView key={node.id} node={node} onAction={node.action ? () => onNavigate(node.action!.targetPageId) : undefined} />
      ))}
    </div>
  );
}

export function Workspace() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const provider = useMemo(() => new LocalDeterministicProvider(), []);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);

  const [project, setProject] = useState<DesignProject | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [projectName, setProjectName] = useState("Signal Workspace");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>("inspect");
  const [zoom, setZoom] = useState(0.58);
  const [pan, setPan] = useState({ x: 50, y: 40 });
  const [playPageId, setPlayPageId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [refineChanges, setRefineChanges] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    repository.load().then((saved) => {
      if (saved) {
        setProject(saved);
        setPrompt(saved.prompt);
        setProjectName(saved.name);
      } else {
        provider.plan({ prompt: DEFAULT_PROMPT, name: "Signal Workspace", direction: defaultDirection }).then(setProject);
      }
    });
  }, [provider, repository]);

  useEffect(() => { if (project) void repository.save(project); }, [project, repository]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activePage = project?.pages.find((page) => page.id === project.activePageId) || project?.pages[0];
  const selectedNode = activePage?.nodes.find((node) => node.id === selectedNodeId);
  const auditIssues = useMemo(() => project ? auditProject(project) : [], [project]);

  const updateProject = useCallback((mutate: (draft: DesignProject) => void) => {
    setProject((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      mutate(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, []);

  const fitView = useCallback(() => {
    if (!project || !canvasRef.current || !project.pages.length) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const minX = Math.min(...project.pages.map((page) => page.x));
    const minY = Math.min(...project.pages.map((page) => page.y));
    const maxX = Math.max(...project.pages.map((page) => page.x + page.width));
    const maxY = Math.max(...project.pages.map((page) => page.y + page.height));
    const width = maxX - minX;
    const height = maxY - minY;
    const nextZoom = clamp(Math.min((rect.width - 120) / width, (rect.height - 120) / height), 0.25, 1.05);
    setZoom(nextZoom);
    setPan({ x: (rect.width - width * nextZoom) / 2 - minX * nextZoom, y: (rect.height - height * nextZoom) / 2 - minY * nextZoom });
  }, [project]);

  const generate = async () => {
    if (!project) return;
    setGenerating(true);
    try {
      const next = await provider.plan({ prompt: prompt.trim() || DEFAULT_PROMPT, name: projectName.trim() || "Untitled product", direction: project.direction });
      setProject(next);
      setSelectedNodeId(null);
      setNotice(`Generated ${next.pages.length} coherent screens locally`);
      window.setTimeout(fitView, 40);
    } finally { setGenerating(false); }
  };

  const applyDirection = (direction: DesignDirection) => {
    updateProject((draft) => {
      const oldTokens = draft.tokens;
      const newTokens = generateTokens(direction);
      retokenizeProject(draft, oldTokens, newTokens);
      const prose = parseDesignMd(draft.designMd).prose;
      draft.direction = direction;
      draft.tokens = newTokens;
      draft.designMd = serializeDesignMd(draft.name, direction, newTokens, prose);
    });
  };

  const changeDirection = <K extends keyof DesignDirection>(key: K, value: DesignDirection[K]) => {
    if (!project) return;
    const next = { ...project.direction, [key]: value };
    if (key === "foundation") next.accent = foundationAccent(value as FoundationId);
    applyDirection(next);
  };

  const updateNode = (pageId: string, nodeId: string, changes: Partial<DesignNode>) => {
    updateProject((draft) => {
      const node = draft.pages.find((page) => page.id === pageId)?.nodes.find((item) => item.id === nodeId);
      if (node) Object.assign(node, changes);
    });
  };
  const updateNodeStyle = (pageId: string, nodeId: string, changes: Partial<DesignNode["style"]>) => {
    updateProject((draft) => {
      const node = draft.pages.find((page) => page.id === pageId)?.nodes.find((item) => item.id === nodeId);
      if (node) node.style = { ...node.style, ...changes };
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, kind: "page" | "node", page: DesignPage, node?: DesignNode) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind, pageId: page.id, nodeId: node?.id, startX: event.clientX, startY: event.clientY, originX: node?.x ?? page.x, originY: node?.y ?? page.y };
    updateProject((draft) => { draft.activePageId = page.id; });
    if (node) { setSelectedNodeId(node.id); setTab("inspect"); }
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const x = drag.originX + (event.clientX - drag.startX) / zoom;
    const y = drag.originY + (event.clientY - drag.startY) / zoom;
    updateProject((draft) => {
      const page = draft.pages.find((item) => item.id === drag.pageId);
      if (!page) return;
      if (drag.kind === "page") { page.x = Math.round(x); page.y = Math.round(y); }
      else {
        const node = page.nodes.find((item) => item.id === drag.nodeId);
        if (node) { node.x = Math.round(x); node.y = Math.round(y); }
      }
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const canvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panDragRef.current = { startX: event.clientX, startY: event.clientY, x: pan.x, y: pan.y };
    setSelectedNodeId(null);
  };
  const canvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag) return;
    setPan({ x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY });
  };
  const canvasPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panDragRef.current) event.currentTarget.releasePointerCapture(event.pointerId);
    panDragRef.current = null;
  };
  const canvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((value) => clamp(value * (event.deltaY > 0 ? 0.9 : 1.1), 0.2, 1.5));
  };

  const setPrototypeTarget = (targetPageId: string) => {
    if (!project || !activePage || !selectedNode) return;
    updateProject((draft) => {
      const page = draft.pages.find((item) => item.id === activePage.id)!;
      const node = page.nodes.find((item) => item.id === selectedNode.id)!;
      draft.flows = draft.flows.filter((flow) => !(flow.fromPageId === page.id && flow.fromNodeId === node.id));
      if (!targetPageId) delete node.action;
      else {
        node.action = { type: "navigate", targetPageId };
        draft.flows.push({ id: `flow_${Date.now().toString(36)}`, fromPageId: page.id, fromNodeId: node.id, toPageId: targetPageId, label: node.text || node.name });
      }
    });
  };

  const regenerateDesignMd = () => {
    if (!project) return;
    const prose = parseDesignMd(project.designMd).prose;
    updateProject((draft) => { draft.designMd = serializeDesignMd(draft.name, draft.direction, draft.tokens, prose); });
    setNotice("DESIGN.md regenerated from structured tokens");
  };
  const applyDesignMdSource = (source: string) => {
    if (!project) return;
    try {
      const parsed = parseDesignMd(source);
      updateProject((draft) => {
        const nextDirection = { ...draft.direction, ...(parsed.direction || {}) } as DesignDirection;
        const generated = generateTokens(nextDirection);
        const nextTokens = mergeTokens(generated, parsed.tokens);
        retokenizeProject(draft, draft.tokens, nextTokens);
        draft.direction = nextDirection;
        draft.tokens = nextTokens;
        draft.designMd = source;
      });
      setNotice("Applied DESIGN.md tokens and preserved prose");
    } catch {
      setNotice("Could not parse DESIGN.md frontmatter");
    }
  };
  const importDesignMd = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    applyDesignMdSource(await file.text());
    event.target.value = "";
  };

  const autoRefine = () => {
    if (!project) return;
    const result = refineProject(project);
    setProject(result.project);
    setRefineChanges(result.changes);
    setNotice(result.changes.length ? `Applied ${result.changes.length} safe refinements` : "No safe auto-refinements needed");
  };

  const exportOpenPencilBridge = async () => {
    if (!project) return;
    const adapter = new LocalDesignAdapter();
    await adapter.load(project);
    downloadText(`${slug(project.name)}.openpencil-bridge.json`, await adapter.export("openpencil-bridge"), "application/json");
  };

  if (!project || !activePage) {
    return <main className="grid h-screen place-items-center bg-[#090a0c] text-[#9299a6]"><div className="flex items-center gap-2"><Sparkles size={15} /> Initializing design engine…</div></main>;
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#090a0c] text-[#eef0f4]">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#242830] bg-[#0d0f13]">
        <div className="flex h-12 items-center gap-2 border-b border-[#242830] px-3">
          <div className="grid size-7 place-items-center rounded-md border border-[#343a45] bg-[#151820]"><Box size={14} /></div>
          <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">AI Design Canvas</div><div className="text-[10px] text-[#737b88]">OpenStitch × OpenPencil</div></div>
          <span className="rounded border border-[#2b3039] bg-[#13161b] px-1.5 py-0.5 text-[9px] text-[#858d99]">MVP</span>
        </div>

        <div className="panel-section space-y-2">
          <div className="panel-label">Project</div>
          <input className="field" aria-label="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <textarea className="textarea min-h-[104px]" aria-label="Product prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button className="tool-button primary w-full" onClick={generate} disabled={generating}><WandSparkles size={13} /> {generating ? "Planning…" : "Generate screens"}</button>
          <div className="flex items-center gap-1.5 text-[10px] text-[#6f7784]"><span className="size-1.5 rounded-full bg-[#4ccb88]" /> Local deterministic provider · no API key</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="panel-section !pb-2"><div className="panel-label !mb-0">Screens · {project.pages.length}</div></div>
          <div className="space-y-0.5 px-2 pb-3">
            {project.pages.map((page, index) => (
              <button key={page.id} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${page.id === activePage.id ? "bg-[#1a1e26] text-white" : "text-[#a2a9b4] hover:bg-[#14171c]"}`} onClick={() => { updateProject((draft) => { draft.activePageId = page.id; }); setSelectedNodeId(null); }}>
                <span className="grid size-5 place-items-center rounded border border-[#2c313a] bg-[#111419] text-[9px] text-[#777f8c]">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[12px]">{page.name}</span>
                <span className="text-[9px] text-[#626a76]">{page.nodes.length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[#242830] p-2 text-[10px] text-[#666e7a]">
          <div className="flex items-center justify-between"><span>Portable contract</span><span className="text-[#9aa2ae]">DESIGN.md</span></div>
          <div className="mt-1 flex items-center justify-between"><span>Editor bridge</span><span className="text-[#9aa2ae]">OpenPencil-ready</span></div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#242830] bg-[#0d0f13] px-2.5">
          <div className="flex items-center gap-1.5">
            <button className="tool-button ghost" title="Selection tool"><MousePointer2 size={13} /></button>
            <div className="mx-1 h-5 w-px bg-[#252a32]" />
            <button className="tool-button" onClick={() => setZoom((value) => clamp(value - 0.1, 0.2, 1.5))}><Minus size={13} /></button>
            <button className="tool-button min-w-[58px]" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button className="tool-button" onClick={() => setZoom((value) => clamp(value + 0.1, 0.2, 1.5))}><Plus size={13} /></button>
            <button className="tool-button" onClick={fitView}><Maximize2 size={13} /> Fit</button>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="tool-button" onClick={() => downloadText(`${slug(project.name)}.canvas.json`, JSON.stringify(project, null, 2), "application/json")}><FileJson size={13} /> JSON</button>
            <button className="tool-button" onClick={() => downloadText("DESIGN.md", project.designMd)}><FileText size={13} /> DESIGN.md</button>
            <button className="tool-button" onClick={() => downloadText(`${slug(activePage.name)}.html`, exportPageHtml(project, activePage), "text/html")}><Download size={13} /> HTML</button>
            <button className="tool-button primary" onClick={() => setPlayPageId(activePage.id)}><Play size={12} fill="currentColor" /> Play</button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={canvasRef}
            className="canvas-grid absolute inset-0 overflow-hidden touch-none"
            onPointerDown={canvasPointerDown}
            onPointerMove={canvasPointerMove}
            onPointerUp={canvasPointerUp}
            onWheel={canvasWheel}
          >
            <div className="absolute left-0 top-0 h-[1800px] w-[2600px]" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
              <svg className="pointer-events-none absolute left-0 top-0 h-[1800px] w-[2600px] overflow-visible">
                {project.flows.map((flow) => {
                  const from = project.pages.find((page) => page.id === flow.fromPageId);
                  const to = project.pages.find((page) => page.id === flow.toPageId);
                  if (!from || !to) return null;
                  const x1 = from.x + from.width;
                  const y1 = from.y + from.height / 2;
                  const x2 = to.x;
                  const y2 = to.y + to.height / 2;
                  const cx = (x1 + x2) / 2;
                  return <path key={flow.id} d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`} fill="none" stroke="#59647a" strokeWidth="2" strokeDasharray="6 6" />;
                })}
              </svg>

              {project.pages.map((page) => (
                <div key={page.id} className="absolute" style={{ left: page.x, top: page.y, width: page.width, height: page.height }}>
                  <div
                    className={`absolute -top-7 left-0 flex h-6 items-center gap-2 rounded px-1.5 text-[11px] ${page.id === activePage.id ? "bg-[#252b37] text-white" : "text-[#8c94a0]"}`}
                    onPointerDown={(e) => startDrag(e, "page", page)} onPointerMove={moveDrag} onPointerUp={endDrag}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: page.id === activePage.id ? project.tokens.colors.accent : "#515866" }} />
                    {page.name}<span className="text-[9px] text-[#646c78]">{page.route}</span>
                  </div>
                  <div
                    className={`relative overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,.34)] ${page.id === activePage.id ? "ring-2 ring-[#6774b8]" : "ring-1 ring-[#323844]"}`}
                    style={{ width: page.width, height: page.height, background: page.background, fontFamily: project.tokens.typography.fontFamily }}
                    onPointerDown={() => updateProject((draft) => { draft.activePageId = page.id; })}
                  >
                    {page.nodes.map((node) => (
                      <NodeView
                        key={node.id}
                        node={node}
                        selected={page.id === activePage.id && selectedNodeId === node.id}
                        onPointerDown={(e) => startDrag(e, "node", page, node)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[#252b34] bg-[#0d1015]/90 px-2.5 py-1.5 text-[10px] text-[#727a87] shadow-lg backdrop-blur">Drag empty canvas to pan · scroll to zoom · drag frame labels or nodes to reposition</div>
        </div>
      </section>

      <aside className="flex w-[318px] shrink-0 flex-col border-l border-[#242830] bg-[#0d0f13]">
        <div className="grid h-12 shrink-0 grid-cols-5 border-b border-[#242830] p-1.5">
          {([
            ["inspect", MousePointer2, "Inspect"], ["design", SlidersHorizontal, "Design"], ["contract", FileText, "Contract"], ["audit", ShieldCheck, "Audit"], ["flow", GitBranch, "Flow"],
          ] as const).map(([id, Icon, title]) => (
            <button key={id} title={title} className={`grid place-items-center rounded-md ${tab === id ? "bg-[#20242c] text-white" : "text-[#69717e] hover:text-[#b5bbc5]"}`} onClick={() => setTab(id)}><Icon size={14} /></button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "inspect" && (
            <>
              <div className="panel-section"><div className="panel-label">Selection</div>{selectedNode ? <><div className="text-[13px] font-semibold">{selectedNode.name}</div><div className="mt-1 text-[10px] text-[#757d89]">{selectedNode.type} · {selectedNode.id}</div></> : <div className="text-[12px] text-[#717987]">Select a node on the canvas to edit it.</div>}</div>
              {selectedNode && (
                <>
                  {selectedNode.text !== undefined && <div className="panel-section"><div className="panel-label">Content</div><textarea className="textarea min-h-[76px]" value={selectedNode.text} onChange={(e) => updateNode(activePage.id, selectedNode.id, { text: e.target.value })} /></div>}
                  <div className="panel-section"><div className="panel-label">Geometry</div><div className="grid grid-cols-2 gap-2">
                    {(["x", "y", "width", "height"] as const).map((key) => <label key={key} className="text-[10px] text-[#747c88]">{key.toUpperCase()}<input className="field mt-1" type="number" value={Math.round(selectedNode[key])} onChange={(e) => updateNode(activePage.id, selectedNode.id, { [key]: Number(e.target.value) })} /></label>)}
                  </div></div>
                  <div className="panel-section"><div className="panel-label">Appearance</div><div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-[#747c88]">Radius<input className="field mt-1" type="number" value={selectedNode.style.radius ?? 0} onChange={(e) => updateNodeStyle(activePage.id, selectedNode.id, { radius: Number(e.target.value) })} /></label>
                    <label className="text-[10px] text-[#747c88]">Padding<input className="field mt-1" type="number" value={selectedNode.style.padding ?? 0} onChange={(e) => updateNodeStyle(activePage.id, selectedNode.id, { padding: Number(e.target.value) })} /></label>
                    <label className="text-[10px] text-[#747c88]">Font size<input className="field mt-1" type="number" value={selectedNode.style.fontSize ?? 0} onChange={(e) => updateNodeStyle(activePage.id, selectedNode.id, { fontSize: Number(e.target.value) })} /></label>
                    <label className="text-[10px] text-[#747c88]">Weight<input className="field mt-1" type="number" value={selectedNode.style.fontWeight ?? 400} onChange={(e) => updateNodeStyle(activePage.id, selectedNode.id, { fontWeight: Number(e.target.value) })} /></label>
                    <label className="col-span-2 text-[10px] text-[#747c88]">Background<input className="field mt-1 font-mono text-[11px]" value={selectedNode.style.background ?? ""} onChange={(e) => updateNodeStyle(activePage.id, selectedNode.id, { background: e.target.value || undefined })} /></label>
                    <label className="col-span-2 text-[10px] text-[#747c88]">Text color<input className="field mt-1 font-mono text-[11px]" value={selectedNode.style.color ?? ""} onChange={(e) => updateNodeStyle(activePage.id, selectedNode.id, { color: e.target.value || undefined })} /></label>
                  </div></div>
                  <div className="panel-section"><div className="panel-label">Prototype action</div><select className="select" value={selectedNode.action?.targetPageId || ""} onChange={(e) => setPrototypeTarget(e.target.value)}><option value="">No navigation</option>{project.pages.filter((page) => page.id !== activePage.id).map((page) => <option key={page.id} value={page.id}>Navigate → {page.name}</option>)}</select><div className="mt-2 text-[10px] leading-4 text-[#666e7a]">In Play mode, double-clicking this element follows its navigation target.</div></div>
                </>
              )}
            </>
          )}

          {tab === "design" && (
            <>
              <div className="panel-section"><div className="panel-label">Foundation</div><select className="select" value={project.direction.foundation} onChange={(e) => changeDirection("foundation", e.target.value as DesignDirection["foundation"])}>{Object.entries(foundations).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select><p className="mb-0 mt-2 text-[11px] leading-4 text-[#727a86]">{foundations[project.direction.foundation].description}</p></div>
              <div className="panel-section space-y-3"><div className="panel-label">Style mixer</div>
                <StyleSelect label="Treatment" value={project.direction.treatment} options={["precision", "editorial", "technical", "quiet", "expressive"]} onChange={(value) => changeDirection("treatment", value as DesignDirection["treatment"])} />
                <StyleSelect label="Density" value={project.direction.density} options={["compact", "balanced", "comfortable"]} onChange={(value) => changeDirection("density", value as DesignDirection["density"])} />
                <StyleSelect label="Radius" value={project.direction.radius} options={["sharp", "soft", "rounded"]} onChange={(value) => changeDirection("radius", value as DesignDirection["radius"])} />
                <StyleSelect label="Motion" value={project.direction.motion} options={["none", "subtle", "snappy"]} onChange={(value) => changeDirection("motion", value as DesignDirection["motion"])} />
                <StyleSelect label="Theme" value={project.direction.theme} options={["dark", "light"]} onChange={(value) => changeDirection("theme", value as DesignDirection["theme"])} />
                <label className="block text-[10px] text-[#747c88]">Accent<div className="mt-1 flex gap-2"><input type="color" className="h-8 w-10 rounded border border-[#2b3039] bg-transparent" value={project.direction.accent} onChange={(e) => changeDirection("accent", e.target.value)} /><input className="field font-mono text-[11px]" value={project.direction.accent} onChange={(e) => changeDirection("accent", e.target.value)} /></div></label>
              </div>
              <div className="panel-section"><div className="panel-label">Token preview</div><div className="grid grid-cols-5 gap-1.5">{Object.entries(project.tokens.colors).slice(0, 10).map(([key, color]) => <div key={key} title={`${key}: ${color}`} className="aspect-square rounded-md border border-black/20" style={{ background: color }} />)}</div><div className="mt-3 flex flex-wrap gap-1">{project.tokens.spacing.map((space) => <span key={space} className="rounded border border-[#292e36] bg-[#14171c] px-1.5 py-1 font-mono text-[9px] text-[#89919d]">{space}</span>)}</div></div>
            </>
          )}

          {tab === "contract" && (
            <>
              <div className="panel-section"><div className="flex items-center justify-between"><div><div className="panel-label">DESIGN.md</div><div className="text-[11px] text-[#737b87]">Portable design contract + machine-readable tokens.</div></div><FileText size={17} className="text-[#777f8d]" /></div></div>
              <div className="p-3"><textarea className="textarea min-h-[430px] font-mono text-[10px] leading-[1.55]" value={project.designMd} onChange={(e) => updateProject((draft) => { draft.designMd = e.target.value; })} /></div>
              <div className="panel-section flex flex-wrap gap-1.5"><button className="tool-button" onClick={() => applyDesignMdSource(project.designMd)}><ScanSearch size={12} /> Apply</button><button className="tool-button" onClick={regenerateDesignMd}><Sparkles size={12} /> Regenerate</button><button className="tool-button" onClick={() => fileInputRef.current?.click()}><Download size={12} className="rotate-180" /> Import</button><button className="tool-button" onClick={() => downloadText("DESIGN.md", project.designMd)}><Download size={12} /> Export</button><input ref={fileInputRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={importDesignMd} /></div>
            </>
          )}

          {tab === "audit" && (
            <>
              <div className="panel-section"><div className="flex items-center justify-between"><div><div className="panel-label">Anti-slop audit</div><div className="text-[11px] text-[#737b87]">Deterministic quality checks across every screen.</div></div><span className={`rounded px-2 py-1 text-[10px] ${auditIssues.some((item) => item.severity === "error") ? "bg-[#31191c] text-[#ff8790]" : "bg-[#16241e] text-[#68d49a]"}`}>{auditIssues.length} issues</span></div><button className="tool-button primary mt-3 w-full" onClick={autoRefine}><ShieldCheck size={13} /> Auto refine safe issues</button></div>
              <div className="space-y-2 p-3">{auditIssues.length === 0 ? <div className="rounded-lg border border-[#25332d] bg-[#101a16] p-3 text-[11px] text-[#72c99b]">No anti-slop rules are currently firing.</div> : auditIssues.map((item) => <button key={item.id} className="w-full rounded-lg border border-[#292e36] bg-[#111419] p-3 text-left hover:border-[#3a414d]" onClick={() => { updateProject((draft) => { draft.activePageId = item.pageId; }); setSelectedNodeId(item.nodeId || null); setTab(item.nodeId ? "inspect" : "audit"); }}><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${item.severity === "error" ? "bg-[#ef6262]" : item.severity === "warning" ? "bg-[#e8a23a]" : "bg-[#7c8cff]"}`} /><span className="text-[11px] font-semibold text-[#d8dce2]">{item.rule}</span></div><p className="mb-1 mt-2 text-[11px] leading-4 text-[#9ba2ad]">{item.message}</p><p className="m-0 text-[10px] leading-4 text-[#6f7783]">{item.suggestion}</p></button>)}</div>
              {refineChanges.length > 0 && <div className="panel-section"><div className="panel-label">Last refinement</div><div className="space-y-1">{refineChanges.slice(0, 8).map((change) => <div key={change} className="text-[10px] leading-4 text-[#838b97]">• {change}</div>)}</div></div>}
            </>
          )}

          {tab === "flow" && (
            <>
              <div className="panel-section"><div className="panel-label">Prototype flow</div><div className="text-[11px] leading-4 text-[#737b87]">Assign navigation from any selected node in Inspect. Edges are stored in the project model and exported with it.</div></div>
              <div className="space-y-2 p-3">{project.flows.length === 0 ? <div className="rounded-lg border border-dashed border-[#303640] p-4 text-center text-[11px] text-[#6e7682]">No prototype edges yet.</div> : project.flows.map((flow) => { const from = project.pages.find((page) => page.id === flow.fromPageId); const to = project.pages.find((page) => page.id === flow.toPageId); return <div key={flow.id} className="rounded-lg border border-[#292e36] bg-[#111419] p-3"><div className="flex items-center gap-2 text-[11px] text-[#d7dae0]"><span>{from?.name}</span><GitBranch size={12} className="text-[#626b78]" /><span>{to?.name}</span></div><div className="mt-1 text-[10px] text-[#707885]">Trigger: {flow.label}</div></div>; })}</div>
              <div className="panel-section"><button className="tool-button w-full" onClick={exportOpenPencilBridge}><FileJson size={12} /> Export OpenPencil bridge JSON</button><p className="mb-0 mt-2 text-[10px] leading-4 text-[#656d79]">The bridge keeps the web app Vercel-safe while allowing a local/remote OpenPencil headless or MCP adapter to become the authoritative canvas engine later.</p></div>
            </>
          )}
        </div>
      </aside>

      {playPageId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-8 backdrop-blur-sm">
          <div className="max-h-full max-w-full overflow-auto rounded-xl border border-[#303640] bg-[#0c0e12] shadow-2xl">
            <div className="sticky top-0 z-10 flex h-11 items-center justify-between border-b border-[#292e36] bg-[#101318]/95 px-3 backdrop-blur"><div className="flex items-center gap-2 text-[11px]"><Play size={12} fill="currentColor" /> Prototype · {project.pages.find((page) => page.id === playPageId)?.name}</div><div className="flex items-center gap-2"><span className="text-[10px] text-[#666e7b]">Double-click linked controls</span><button className="tool-button" onClick={() => setPlayPageId(null)}><X size={13} /></button></div></div>
            <PlayPreview project={project} pageId={playPageId} onNavigate={setPlayPageId} />
          </div>
        </div>
      )}

      {notice && <div className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-lg border border-[#343a45] bg-[#171a20] px-3 py-2 text-[11px] text-[#dce0e6] shadow-xl">{notice}</div>}
    </main>
  );
}

function StyleSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block text-[10px] text-[#747c88]">{label}<select className="select mt-1 capitalize" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
