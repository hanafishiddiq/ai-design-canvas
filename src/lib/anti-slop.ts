import { parseDesignMd } from "./design-md";
import type { AuditIssue, DesignNode, DesignProject } from "./types";

const makeIssue = (rule: string, severity: AuditIssue["severity"], message: string, pageId: string, suggestion: string, nodeId?: string): AuditIssue => ({ id: `${rule}:${pageId}:${nodeId || "page"}`, rule, severity, message, pageId, nodeId, suggestion });
const isHex = (value?: string): value is string => !!value && /^#[0-9a-f]{6}$/i.test(value);

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function effectiveBackground(node: DesignNode, pageNodes: DesignNode[], pageBackground: string): string {
  if (isHex(node.style.background)) return node.style.background;
  let parentId = node.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = pageNodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    if (isHex(parent.style.background)) return parent.style.background;
    parentId = parent.parentId;
  }
  return pageBackground;
}
function overlapRatio(a: DesignNode, b: DesignNode) {
  const left = Math.max(a.x, b.x), top = Math.max(a.y, b.y), right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  const area = Math.max(0, right - left) * Math.max(0, bottom - top);
  const base = Math.min(Math.max(1, a.width * a.height), Math.max(1, b.width * b.height));
  return area / base;
}
function styleSignature(node: DesignNode) {
  return [node.type, node.name.toLowerCase(), node.style.radius ?? 0, node.style.padding ?? 0, node.style.fontSize ?? 0, node.style.fontWeight ?? 0].join("|");
}

export interface AuditSummary {
  errors: number;
  warnings: number;
  info: number;
  score: number;
  issues: AuditIssue[];
}

export function auditProject(project: DesignProject): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const designMd = parseDesignMd(project.designMd);
  const mdAccent = designMd.tokens?.colors?.accent;
  if (mdAccent && mdAccent !== project.tokens.colors.accent) issues.push(makeIssue("design-md-drift", "warning", `DESIGN.md accent ${mdAccent} differs from the active token ${project.tokens.colors.accent}.`, project.activePageId, "Re-sync DESIGN.md or intentionally update the active token."));

  const headingSizes: Array<{ pageId: string; pageName: string; size: number }> = [];
  const repeated = new Map<string, Array<{ pageId: string; nodeId: string }>>();

  for (const page of project.pages) {
    const cards = page.nodes.filter((node) => node.type === "card");
    if (cards.length > 6) issues.push(makeIssue("card-overload", "warning", `${cards.length} cards compete for hierarchy on ${page.name}.`, page.id, "Group related content and remove redundant containers."));
    const headings = page.nodes.filter((node) => node.type === "text" && (node.style.fontSize || 0) >= 24).sort((a, b) => (b.style.fontSize || 0) - (a.style.fontSize || 0));
    if (!headings.length) issues.push(makeIssue("weak-hierarchy", "warning", `${page.name} has no clear primary heading.`, page.id, "Create one dominant page heading around 28–44px."));
    else headingSizes.push({ pageId: page.id, pageName: page.name, size: headings[0].style.fontSize || 0 });

    const roots = page.nodes.filter((node) => !node.parentId);
    for (let i = 0; i < roots.length; i += 1) {
      for (let j = i + 1; j < roots.length; j += 1) {
        const ratio = overlapRatio(roots[i], roots[j]);
        if (ratio > .55 && roots[i].type !== "frame" && roots[j].type !== "frame") issues.push(makeIssue("accidental-overlap", "warning", `${roots[i].name} and ${roots[j].name} overlap by ${Math.round(ratio * 100)}%.`, page.id, "Separate the elements or make the overlap explicit through a shared frame.", roots[j].id));
      }
    }

    for (const node of page.nodes) {
      const radius = node.style.radius || 0;
      if (radius > 24 && radius < 900) issues.push(makeIssue("excessive-radius", "warning", `${node.name} uses a ${radius}px radius.`, page.id, "Use the system medium/large radius instead.", node.id));
      if (radius >= 900 && node.type !== "button") issues.push(makeIssue("pill-abuse", "warning", `${node.name} uses a pill radius without a compact-control purpose.`, page.id, "Reserve pills for tags and small controls.", node.id));
      if ((node.style.fontSize || 0) > 56) issues.push(makeIssue("giant-heading", "warning", `${node.name} is ${node.style.fontSize}px.`, page.id, "Cap product UI headings around 48px unless the screen is genuinely editorial.", node.id));
      if (node.type === "text" && (node.style.fontSize || 0) > 0 && (node.style.fontSize || 0) < 11) issues.push(makeIssue("tiny-text", "warning", `${node.name} uses ${node.style.fontSize}px text.`, page.id, "Use at least 11–12px for persistent interface text.", node.id));
      if ((node.type === "button" || node.type === "input") && (node.height < 36 || node.width < 36)) issues.push(makeIssue("small-control-target", "error", `${node.name} is ${Math.round(node.width)}×${Math.round(node.height)}.`, page.id, "Give interactive controls at least a 36px target in this product UI.", node.id));
      if (node.style.background?.toLowerCase().includes("gradient")) issues.push(makeIssue("decorative-gradient", "warning", `${node.name} uses a gradient surface.`, page.id, "Prefer a semantic solid surface unless the gradient communicates data/state.", node.id));
      if (node.style.padding && !project.tokens.spacing.includes(node.style.padding)) issues.push(makeIssue("spacing-drift", "info", `${node.name} uses ${node.style.padding}px padding outside the token scale.`, page.id, "Snap padding to the nearest spacing token.", node.id));

      if (node.x < -1 || node.y < -1 || node.x + node.width > page.width + 1 || node.y + node.height > page.height + 1) {
        if (!node.parentId) issues.push(makeIssue("off-canvas", "warning", `${node.name} extends beyond ${page.name}.`, page.id, "Clamp the node to the screen or explicitly nest it inside an overflow container.", node.id));
      }

      if (node.type === "text" && isHex(node.style.color)) {
        const background = effectiveBackground(node, page.nodes, page.background);
        if (isHex(background)) {
          const ratio = contrast(node.style.color, background);
          const large = (node.style.fontSize || 0) >= 18 && (node.style.fontWeight || 400) >= 600;
          const threshold = large ? 3 : 4.5;
          if (ratio < threshold) issues.push(makeIssue("low-contrast", "error", `${node.name} contrast is about ${ratio.toFixed(2)}:1.`, page.id, `Reach at least ${threshold}:1 for this text size/weight.`, node.id));
        }
      }
      if (node.type === "button" && isHex(node.style.color) && isHex(node.style.background) && contrast(node.style.color, node.style.background) < 4.5) issues.push(makeIssue("control-contrast", "error", `${node.name} label has insufficient contrast against its button surface.`, page.id, "Use semantic accentText/text tokens that meet 4.5:1.", node.id));

      if (!node.component && ["card", "button", "input"].includes(node.type)) {
        const key = styleSignature(node);
        const list = repeated.get(key) || [];
        list.push({ pageId: page.id, nodeId: node.id });
        repeated.set(key, list);
      }
      const semanticColors = new Set(Object.values(project.tokens.colors));
      for (const color of [node.style.background, node.style.color, node.style.borderColor]) {
        if (isHex(color) && !semanticColors.has(color)) issues.push(makeIssue("color-token-drift", "info", `${node.name} uses custom color ${color}.`, page.id, "Promote intentional colors to variables or use a semantic token.", node.id));
      }
    }
  }

  if (headingSizes.length > 1) {
    const min = Math.min(...headingSizes.map((item) => item.size)), max = Math.max(...headingSizes.map((item) => item.size));
    if (max - min > 14) {
      for (const item of headingSizes) issues.push(makeIssue("cross-screen-heading-drift", "info", `${item.pageName}'s primary heading is ${item.size}px while product screens range ${min}–${max}px.`, item.pageId, "Use an intentional cross-screen heading scale or document the exception."));
    }
  }

  for (const occurrences of repeated.values()) {
    const pages = new Set(occurrences.map((item) => item.pageId));
    if (occurrences.length >= 3 && pages.size >= 2) {
      const first = occurrences[0];
      issues.push(makeIssue("component-opportunity", "info", `${occurrences.length} visually similar controls repeat across ${pages.size} screens without a component binding.`, first.pageId, "Promote the repeated pattern to a component with instances.", first.nodeId));
    }
  }
  return issues;
}

export function summarizeAudit(project: DesignProject): AuditSummary {
  const issues = auditProject(project);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const info = issues.length - errors - warnings;
  const score = Math.max(0, Math.round(100 - errors * 9 - warnings * 4 - info * 1.25));
  return { errors, warnings, info, score, issues };
}

const nearest = (value: number, values: number[]) => values.reduce((a, b) => Math.abs(b - value) < Math.abs(a - value) ? b : a);

export function refineProject(project: DesignProject): { project: DesignProject; changes: string[] } {
  const copy = structuredClone(project);
  const changes: string[] = [];
  for (const page of copy.pages) {
    for (const node of page.nodes) {
      if ((node.style.fontSize || 0) > 56) { node.style.fontSize = 48; changes.push(`${page.name}: reduced ${node.name} heading size to 48px`); }
      if (node.type === "text" && (node.style.fontSize || 0) > 0 && (node.style.fontSize || 0) < 11) { node.style.fontSize = 11; changes.push(`${page.name}: raised ${node.name} to 11px minimum text size`); }
      if ((node.style.radius || 0) > 24 && (node.style.radius || 0) < 900) { node.style.radius = copy.tokens.radius.lg; changes.push(`${page.name}: normalized ${node.name} radius`); }
      if (node.style.background?.toLowerCase().includes("gradient")) { node.style.background = copy.tokens.colors.surfaceElevated; changes.push(`${page.name}: replaced decorative gradient on ${node.name}`); }
      if (node.style.padding && !copy.tokens.spacing.includes(node.style.padding)) { node.style.padding = nearest(node.style.padding, copy.tokens.spacing); changes.push(`${page.name}: snapped ${node.name} padding to spacing scale`); }
      if ((node.type === "button" || node.type === "input") && node.height < 36) { node.height = 36; changes.push(`${page.name}: increased ${node.name} target height to 36px`); }
      if ((node.type === "button" || node.type === "input") && node.width < 36) { node.width = 36; changes.push(`${page.name}: increased ${node.name} target width to 36px`); }
      if (!node.parentId) {
        const x = Math.max(0, Math.min(node.x, Math.max(0, page.width - node.width)));
        const y = Math.max(0, Math.min(node.y, Math.max(0, page.height - node.height)));
        if (x !== node.x || y !== node.y) { node.x = x; node.y = y; changes.push(`${page.name}: clamped ${node.name} to the screen bounds`); }
      }
      if (node.type === "text" && isHex(node.style.color)) {
        const background = effectiveBackground(node, page.nodes, page.background);
        if (isHex(background)) {
          const ratio = contrast(node.style.color, background);
          const large = (node.style.fontSize || 0) >= 18 && (node.style.fontWeight || 400) >= 600;
          if (ratio < (large ? 3 : 4.5)) { node.style.color = copy.tokens.colors.text; changes.push(`${page.name}: increased contrast for ${node.name}`); }
        }
      }
      if (node.type === "button" && isHex(node.style.color) && isHex(node.style.background) && contrast(node.style.color, node.style.background) < 4.5) { node.style.color = copy.tokens.colors.accentText; changes.push(`${page.name}: increased button label contrast for ${node.name}`); }
    }
  }
  copy.updatedAt = new Date().toISOString();
  return { project: copy, changes };
}
