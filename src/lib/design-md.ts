import YAML from "yaml";
import { directionIntent } from "./foundations";
import type { DesignDirection, DesignTokens } from "./types";

export interface ParsedDesignMd {
  direction?: Partial<DesignDirection>;
  tokens?: Partial<DesignTokens>;
  prose: string;
  rawFrontmatter: Record<string, unknown>;
}

export function serializeDesignMd(name: string, direction: DesignDirection, tokens: DesignTokens, existingProse?: string): string {
  const frontmatter = { schema: "ai-design-canvas/v1", project: name, direction, tokens };
  const prose = existingProse?.trim() || `# Art direction\n\n${directionIntent(direction).map((line) => `- ${line}`).join("\n")}\n\n## Interaction\n\nMotion communicates state and hierarchy. Avoid ornamental animation.\n\n## Do / Don’t\n\n- Do use semantic surfaces, consistent spacing, and obvious focus states.\n- Do keep data-dense screens readable through hierarchy rather than decoration.\n- Don’t stack unnecessary cards inside cards.\n- Don’t use gradients, giant display type, or excessive pill controls by default.`;
  return `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${prose.trim()}\n`;
}

export function parseDesignMd(source: string): ParsedDesignMd {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { prose: source.trim(), rawFrontmatter: {} };
  const raw = (YAML.parse(match[1]) || {}) as Record<string, unknown>;
  const direction = typeof raw.direction === "object" && raw.direction ? raw.direction as Partial<DesignDirection> : undefined;
  const tokens = typeof raw.tokens === "object" && raw.tokens ? raw.tokens as Partial<DesignTokens> : undefined;
  return { direction, tokens, prose: match[2].trim(), rawFrontmatter: raw };
}

export function mergeTokens(base: DesignTokens, incoming?: Partial<DesignTokens>): DesignTokens {
  if (!incoming) return base;
  return {
    ...base,
    ...incoming,
    colors: { ...base.colors, ...(incoming.colors || {}) },
    typography: { ...base.typography, ...(incoming.typography || {}) },
    radius: { ...base.radius, ...(incoming.radius || {}) },
    motion: { ...base.motion, ...(incoming.motion || {}) },
    spacing: Array.isArray(incoming.spacing) && incoming.spacing.length ? incoming.spacing : base.spacing,
  };
}
