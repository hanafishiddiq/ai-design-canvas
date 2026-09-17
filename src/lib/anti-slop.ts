import type { AuditIssue, DesignProject } from "./types";

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

export function auditProject(project: DesignProject): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const page of project.pages) {
    const cards = page.nodes.filter((node) => node.type === "card");
    if (cards.length > 6) issues.push(makeIssue("card-overload", "warning", `${cards.length} cards compete for hierarchy on ${page.name}.`, page.id, "Group related content and remove redundant containers."));
    const headings = page.nodes.filter((node) => node.type === "text" && (node.style.fontSize || 0) >= 28);
    if (!headings.length) issues.push(makeIssue("weak-hierarchy", "warning", `${page.name} has no clear primary heading.`, page.id, "Create one dominant page heading around 28–44px."));

    for (const node of page.nodes) {
      const radius = node.style.radius || 0;
      if (radius > 24 && radius < 900) issues.push(makeIssue("excessive-radius", "warning", `${node.name} uses a ${radius}px radius.`, page.id, "Use the system medium/large radius instead.", node.id));
      if (radius >= 900 && node.type !== "button") issues.push(makeIssue("pill-abuse", "warning", `${node.name} uses a pill radius without a compact-control purpose.`, page.id, "Reserve pills for tags and small controls.", node.id));
      if ((node.style.fontSize || 0) > 56) issues.push(makeIssue("giant-heading", "warning", `${node.name} is ${node.style.fontSize}px.`, page.id, "Cap product UI headings around 48px unless the screen is genuinely editorial.", node.id));
      if (node.style.background?.toLowerCase().includes("gradient")) issues.push(makeIssue("decorative-gradient", "warning", `${node.name} uses a gradient surface.`, page.id, "Prefer a semantic solid surface unless the gradient communicates data/state.", node.id));
      if (node.style.padding && !project.tokens.spacing.includes(node.style.padding)) issues.push(makeIssue("spacing-drift", "info", `${node.name} uses ${node.style.padding}px padding outside the token scale.`, page.id, "Snap padding to the nearest spacing token.", node.id));
      if (node.type === "text" && isHex(node.style.color) && isHex(page.background) && contrast(node.style.color, page.background) < 3) {
        issues.push(makeIssue("low-contrast", "error", `${node.name} may have insufficient contrast against the page.`, page.id, "Use the primary or muted semantic text token.", node.id));
      }
    }
  }
  return issues;
}

const nearest = (value: number, values: number[]) => values.reduce((a, b) => Math.abs(b - value) < Math.abs(a - value) ? b : a);

export function refineProject(project: DesignProject): { project: DesignProject; changes: string[] } {
  const copy = structuredClone(project);
  const changes: string[] = [];
  for (const page of copy.pages) {
    for (const node of page.nodes) {
      if ((node.style.fontSize || 0) > 56) { node.style.fontSize = 48; changes.push(`${page.name}: reduced ${node.name} heading size to 48px`); }
      if ((node.style.radius || 0) > 24 && (node.style.radius || 0) < 900) { node.style.radius = copy.tokens.radius.lg; changes.push(`${page.name}: normalized ${node.name} radius`); }
      if (node.style.background?.toLowerCase().includes("gradient")) { node.style.background = copy.tokens.colors.surfaceElevated; changes.push(`${page.name}: replaced decorative gradient on ${node.name}`); }
      if (node.style.padding && !copy.tokens.spacing.includes(node.style.padding)) { node.style.padding = nearest(node.style.padding, copy.tokens.spacing); changes.push(`${page.name}: snapped ${node.name} padding to spacing scale`); }
      if (node.type === "text" && isHex(node.style.color) && isHex(page.background) && contrast(node.style.color, page.background) < 3) { node.style.color = copy.tokens.colors.text; changes.push(`${page.name}: increased contrast for ${node.name}`); }
    }
  }
  copy.updatedAt = new Date().toISOString();
  return { project: copy, changes };
}
