import type { CodeMapping, CodeTarget, DesignProject } from "./types";

let counter = 0;
const uid = () => `map_${Date.now().toString(36)}_${(counter++).toString(36)}`;
const now = () => new Date().toISOString();

export interface CodeMappingInput {
  target: CodeTarget;
  pageId?: string;
  nodeId?: string;
  componentId?: string;
  filePath: string;
  symbol?: string;
  route?: string;
  repository?: string;
  sourceHash?: string;
}

export function upsertCodeMapping(project: DesignProject, input: CodeMappingInput): DesignProject {
  const next = structuredClone(project);
  const existing = next.codeMappings.find((mapping) =>
    mapping.target === input.target
    && mapping.filePath === input.filePath
    && mapping.pageId === input.pageId
    && mapping.nodeId === input.nodeId
    && mapping.componentId === input.componentId,
  );
  const updatedAt = now();
  if (existing) {
    Object.assign(existing, structuredClone(input), { updatedAt });
  } else {
    next.codeMappings.push({ id: uid(), ...structuredClone(input), createdAt: updatedAt, updatedAt });
  }
  next.updatedAt = updatedAt;
  return next;
}

export function removeCodeMapping(project: DesignProject, mappingId: string): DesignProject {
  const next = structuredClone(project);
  next.codeMappings = next.codeMappings.filter((mapping) => mapping.id !== mappingId);
  next.updatedAt = now();
  return next;
}

export function mappingsForPage(project: DesignProject, pageId: string): CodeMapping[] {
  const nodeIds = new Set(project.pages.find((page) => page.id === pageId)?.nodes.map((node) => node.id) || []);
  return project.codeMappings.filter((mapping) => mapping.pageId === pageId || (mapping.nodeId && nodeIds.has(mapping.nodeId)));
}

export function suggestPageCodeMapping(project: DesignProject, pageId: string, target: Extract<CodeTarget, "react" | "nextjs" | "html"> = "react"): CodeMappingInput {
  const page = project.pages.find((item) => item.id === pageId);
  if (!page) throw new Error(`Page not found: ${pageId}`);
  const slug = page.route.replace(/^\//, "").replace(/[^a-z0-9/_-]/gi, "-") || "index";
  const symbol = page.name.replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join("") || "GeneratedScreen";
  const filePath = target === "nextjs" ? `app/${slug === "index" ? "" : `${slug}/`}page.tsx` : target === "html" ? `generated/${slug}.html` : `src/screens/${symbol}.tsx`;
  return { target, pageId, filePath, symbol: target === "html" ? undefined : symbol, route: page.route, sourceHash: `${project.version}:${project.updatedAt}:${page.id}` };
}

export function codeMappingCoverage(project: DesignProject) {
  const mappedPages = new Set(project.codeMappings.map((mapping) => mapping.pageId).filter((id): id is string => !!id));
  const mappedNodes = new Set(project.codeMappings.map((mapping) => mapping.nodeId).filter((id): id is string => !!id));
  const mappedComponents = new Set(project.codeMappings.map((mapping) => mapping.componentId).filter((id): id is string => !!id));
  const totalNodes = project.pages.reduce((sum, page) => sum + page.nodes.length, 0);
  return {
    pages: { mapped: mappedPages.size, total: project.pages.length },
    nodes: { mapped: mappedNodes.size, total: totalNodes },
    components: { mapped: mappedComponents.size, total: Object.keys(project.components).length },
  };
}
