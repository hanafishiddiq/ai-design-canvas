import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, basename } from "node:path";

const args = process.argv.slice(2);
const value = (name, fallback) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] || fallback : fallback; };
const root = resolve(value("root", process.cwd()));
const output = resolve(value("out", join(root, ".adc-repo-manifest.json")));
const maxFiles = Number(value("max-files", process.env.ADC_REPO_MAX_FILES || "15000"));
const EXCLUDED = new Set(["node_modules",".git",".next","dist","build","coverage",".turbo",".vercel",".cache","vendor"]);
const TEXT_EXT = new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs",".vue",".svelte",".html",".css",".scss",".sass",".less",".json",".md"]);
const ASSET_EXT = new Set([".png",".jpg",".jpeg",".webp",".gif",".svg",".ico",".avif",".woff",".woff2",".ttf",".otf"]);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const slash = (path) => path.replace(/\\/g, "/");

async function walk(dir, out = []) {
  if (out.length >= maxFiles) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
    if (out.length >= maxFiles) break;
  }
  return out;
}
function routeFromApp(file) {
  const normalized = slash(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?app\/(.+\/)?page\.(?:[cm]?[jt]sx?)$/);
  if (!match) return null;
  const segments = (match[1] || "").split("/").filter(Boolean).filter((segment) => !/^\(.+\)$/.test(segment) && !segment.startsWith("@"));
  return "/" + segments.map((segment) => segment.startsWith("[[...") ? `*${segment.slice(5,-2)}?` : segment.startsWith("[...") ? `*${segment.slice(4,-1)}` : segment.startsWith("[") ? `:${segment.slice(1,-1)}` : segment).join("/");
}
function routeFromPages(file) {
  const normalized = slash(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?pages\/(.+)\.(?:[cm]?[jt]sx?)$/);
  if (!match || /(?:^|\/)_(?:app|document|error)$/.test(match[1])) return null;
  const parts = match[1].split("/");
  if (parts.at(-1) === "index") parts.pop();
  return "/" + parts.map((segment) => segment.startsWith("[...") ? `*${segment.slice(4,-1)}` : segment.startsWith("[") ? `:${segment.slice(1,-1)}` : segment).join("/");
}
function language(ext) {
  return ({".ts":"typescript",".tsx":"tsx",".js":"javascript",".jsx":"jsx",".vue":"vue",".svelte":"svelte",".css":"css",".scss":"scss",".html":"html",".json":"json"}[ext] || ext.slice(1));
}
function exportedComponents(source, path) {
  const names = new Set();
  const patterns = [
    /export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g,
    /export\s+(?:const|class)\s+([A-Z][A-Za-z0-9_]*)/g,
    /export\s*\{([^}]+)\}/g,
  ];
  let match;
  for (const pattern of patterns) while ((match = pattern.exec(source))) {
    if (pattern === patterns[2]) {
      for (const raw of match[1].split(",")) {
        const name = raw.trim().split(/\s+as\s+/i).at(-1)?.trim();
        if (name && /^[A-Z]/.test(name)) names.add(name);
      }
    } else names.add(match[1]);
  }
  const ext = extname(path);
  if ((ext === ".vue" || ext === ".svelte") && names.size === 0) {
    const name = basename(path, ext).replace(/[^A-Za-z0-9]+/g," ");
    const symbol = name.split(/\s+/).filter(Boolean).map((part)=>part[0]?.toUpperCase()+part.slice(1)).join("");
    if (symbol) names.add(symbol);
  }
  return [...names];
}
function cssTokens(source) {
  const tokens = [];
  const regex = /(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/g;
  let match; while ((match = regex.exec(source))) tokens.push({ name: match[1], value: match[2].trim() });
  return tokens;
}
function routerRoutes(source) {
  const out=[]; const regex=/<Route\b[^>]*\bpath\s*=\s*["']([^"']+)["'][^>]*>/g;
  let match; while((match=regex.exec(source))) out.push(match[1]); return out;
}

const fullFiles = await walk(root);
const files = [];
const routes = [];
const components = [];
const tokens = [];
const assets = [];
let frameworks = [];
let packageJson = null;

for (const full of fullFiles) {
  const path = slash(relative(root, full));
  const ext = extname(full).toLowerCase();
  if (ASSET_EXT.has(ext)) { assets.push({ path, kind: ext.slice(1), hash: sha(await readFile(full)) }); continue; }
  if (!TEXT_EXT.has(ext)) continue;
  const info = await stat(full);
  if (info.size > 1_500_000) continue;
  const source = await readFile(full, "utf8");
  const hash = sha(source);
  files.push({ path, hash, bytes: info.size, language: language(ext) });
  if (path === "package.json") {
    try { packageJson = JSON.parse(source); } catch { /* ignore */ }
  }
  const appRoute = routeFromApp(path) ?? routeFromPages(path);
  if (appRoute !== null) routes.push({ path: appRoute || "/", file: path, source: "filesystem" });
  for (const route of routerRoutes(source)) routes.push({ path: route, file: path, source: "router" });
  for (const name of exportedComponents(source, path)) components.push({ name, file: path, hash });
  if ([".css",".scss",".sass",".less"].includes(ext)) for (const token of cssTokens(source)) tokens.push({ ...token, file: path });
}
if (packageJson) {
  const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
  frameworks = [
    ["next","Next.js"],["react","React"],["vue","Vue"],["svelte","Svelte"],["@angular/core","Angular"],["astro","Astro"],["tailwindcss","Tailwind CSS"],
  ].filter(([key])=>deps[key]).map(([,label])=>label);
}
const uniqueBy = (items, key) => [...new Map(items.map((item)=>[key(item),item])).values()];
const sortedFiles = files.sort((a,b)=>a.path.localeCompare(b.path));
const rootFingerprint = sha(sortedFiles.map((file)=>`${file.path}:${file.hash}`).join("\n"));
const manifest = {
  schema: "ai-design-canvas/repository-manifest/v1",
  generatedAt: new Date().toISOString(),
  rootName: basename(root),
  rootFingerprint,
  frameworks,
  files: sortedFiles,
  routes: uniqueBy(routes, (item)=>`${item.path}:${item.file}`).sort((a,b)=>a.path.localeCompare(b.path)),
  components: uniqueBy(components, (item)=>`${item.name}:${item.file}`).sort((a,b)=>a.name.localeCompare(b.name)),
  tokens: uniqueBy(tokens, (item)=>`${item.name}:${item.file}`).sort((a,b)=>a.name.localeCompare(b.name)),
  assets: assets.sort((a,b)=>a.path.localeCompare(b.path)),
  truncated: fullFiles.length >= maxFiles,
};
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Wrote ${output}`);
console.log(`${manifest.routes.length} routes · ${manifest.components.length} components · ${manifest.tokens.length} CSS tokens · ${manifest.assets.length} assets`);
console.log(`fingerprint ${rootFingerprint}`);
