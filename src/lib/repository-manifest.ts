import { upsertCodeMapping, type CodeMappingInput } from "./code-mapping";
import type { CodeTarget, DesignProject } from "./types";

export interface RepositoryManifestFile { path: string; hash: string; bytes: number; language: string }
export interface RepositoryManifestRoute { path: string; file: string; source: string }
export interface RepositoryManifestComponent { name: string; file: string; hash: string }
export interface RepositoryManifestToken { name: string; value: string; file: string }
export interface RepositoryManifestAsset { path: string; kind: string; hash: string }
export interface RepositoryManifest {
  schema: "ai-design-canvas/repository-manifest/v1";
  generatedAt: string;
  rootName: string;
  rootFingerprint: string;
  frameworks: string[];
  files: RepositoryManifestFile[];
  routes: RepositoryManifestRoute[];
  components: RepositoryManifestComponent[];
  tokens: RepositoryManifestToken[];
  assets: RepositoryManifestAsset[];
  truncated?: boolean;
}
export interface MappingSuggestion {
  confidence: number;
  reason: string;
  mapping: CodeMappingInput;
}

const normalizeRoute = (value: string) => {
  const clean = (value || "/").replace(/\/$/, "") || "/";
  return clean.replace(/\[[^\]]+\]/g, ":param").replace(/:[^/]+/g, ":param").replace(/\*[^/]+\??/g, "*");
};
const symbolFor = (name: string) => name.replace(/[^A-Za-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean).map((part)=>part[0]?.toUpperCase()+part.slice(1)).join("");
const targetFor = (manifest: RepositoryManifest): Extract<CodeTarget,"react"|"nextjs"|"html"> =>
  manifest.frameworks.includes("Next.js") ? "nextjs" : manifest.frameworks.includes("React") ? "react" : "html";

export function parseRepositoryManifest(source: string): RepositoryManifest {
  let value: unknown;
  try { value = JSON.parse(source); } catch (error) { throw new Error(`Invalid repository manifest JSON: ${error instanceof Error ? error.message : String(error)}`); }
  const manifest = value as Partial<RepositoryManifest>;
  if (manifest.schema !== "ai-design-canvas/repository-manifest/v1") throw new Error("Unsupported repository manifest schema.");
  if (!manifest.rootFingerprint || !Array.isArray(manifest.routes) || !Array.isArray(manifest.components) || !Array.isArray(manifest.files)) throw new Error("Repository manifest is incomplete.");
  return manifest as RepositoryManifest;
}

export function suggestRepositoryMappings(project: DesignProject, manifest: RepositoryManifest): MappingSuggestion[] {
  const target = targetFor(manifest);
  const suggestions: MappingSuggestion[] = [];
  for (const page of project.pages) {
    const normalized = normalizeRoute(page.route);
    const exact = manifest.routes.find((route) => normalizeRoute(route.path) === normalized);
    const symbol = symbolFor(page.name);
    const component = manifest.components.find((candidate) => candidate.name.toLowerCase() === symbol.toLowerCase());
    if (exact) {
      suggestions.push({
        confidence: 0.98,
        reason: `Exact route match ${exact.path}`,
        mapping: { target, pageId: page.id, filePath: exact.file, route: page.route, symbol: component?.name, repository: manifest.rootFingerprint, sourceHash: manifest.files.find((file)=>file.path===exact.file)?.hash },
      });
    } else if (component) {
      suggestions.push({
        confidence: 0.76,
        reason: `Component symbol match ${component.name}`,
        mapping: { target, pageId: page.id, filePath: component.file, route: page.route, symbol: component.name, repository: manifest.rootFingerprint, sourceHash: component.hash },
      });
    }
  }
  for (const component of Object.values(project.components)) {
    const symbol = symbolFor(component.name);
    const found = manifest.components.find((candidate) => candidate.name.toLowerCase() === symbol.toLowerCase());
    if (found) suggestions.push({
      confidence: 0.82, reason: `Reusable component symbol match ${found.name}`,
      mapping: { target, componentId: component.id, filePath: found.file, symbol: found.name, repository: manifest.rootFingerprint, sourceHash: found.hash },
    });
  }
  return suggestions.sort((a,b)=>b.confidence-a.confidence);
}

export function applyRepositoryMappingSuggestions(project: DesignProject, suggestions: MappingSuggestion[], minimumConfidence = 0.75) {
  let next = structuredClone(project);
  for (const suggestion of suggestions) if (suggestion.confidence >= minimumConfidence) next = upsertCodeMapping(next, suggestion.mapping);
  return next;
}

export function repositoryContextSummary(manifest: RepositoryManifest) {
  return {
    rootName: manifest.rootName,
    fingerprint: manifest.rootFingerprint,
    frameworks: manifest.frameworks,
    routes: manifest.routes.length,
    components: manifest.components.length,
    tokens: manifest.tokens.length,
    assets: manifest.assets.length,
    truncated: !!manifest.truncated,
  };
}

export function tokenDriftReport(project: DesignProject, manifest: RepositoryManifest) {
  const css = new Map(manifest.tokens.map((token)=>[token.name.toLowerCase(), token]));
  const issues: Array<{ token: string; design: string | number; code?: string; status: "mapped"|"missing"|"different" }> = [];
  for (const [name,value] of Object.entries(project.tokens.colors)) {
    const candidates=[`--${name}`,`--color-${name}`,`--${name.replace(/[A-Z]/g,(m)=>`-${m.toLowerCase()}`)}`];
    const found=candidates.map((candidate)=>css.get(candidate.toLowerCase())).find(Boolean);
    if (!found) issues.push({token:name,design:value,status:"missing"});
    else issues.push({token:name,design:value,code:found.value,status:found.value.toLowerCase()===String(value).toLowerCase()?"mapped":"different"});
  }
  return issues;
}
