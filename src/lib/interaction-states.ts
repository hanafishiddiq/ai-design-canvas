import type { DesignNode, DesignTokens, InteractionVisualState, NodeStateOverride, NodeStyle } from "./types";

function mix(hex: string | undefined, target: string, amount: number) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex) || !/^#[0-9a-f]{6}$/i.test(target)) return hex;
  const parse = (value: string) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const a = parse(hex), b = parse(target);
  const channels = a.map((value, index) => Math.round(value + (b[index] - value) * amount));
  return "#" + channels.map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function deriveStateOverride(node: DesignNode, state: InteractionVisualState, tokens?: DesignTokens): NodeStateOverride {
  const style: Partial<NodeStyle> = {};
  const base = node.style.background;
  if (state === "hover") {
    style.background = mix(base, tokens?.colors.text || "#ffffff", 0.08);
    style.opacity = Math.min(1, (node.style.opacity ?? 1) + 0.02);
  } else if (state === "pressed") {
    style.background = mix(base, tokens?.colors.text || "#ffffff", 0.15);
    style.opacity = 0.96;
  } else if (state === "disabled") {
    style.opacity = 0.45;
  } else if (state === "loading") {
    style.opacity = 0.7;
  } else if (state === "error") {
    style.background = tokens?.colors.danger;
    style.color = tokens?.colors.accentText || "#ffffff";
  } else if (state === "success") {
    style.background = tokens?.colors.success;
    style.color = tokens?.colors.accentText || "#ffffff";
  }
  return { style, ...(state === "loading" && node.text ? { text: "Loading…" } : {}) };
}

export function resolveNodePresentation(node: DesignNode, state?: InteractionVisualState | "default") {
  if (!state || state === "default") return { style: node.style, text: node.text };
  const override = node.states?.[state];
  return {
    style: { ...node.style, ...(override?.style || {}) },
    text: override?.text ?? node.text,
  };
}

export function setNodeStateOverride(node: DesignNode, state: InteractionVisualState, override: NodeStateOverride): DesignNode {
  return {
    ...structuredClone(node),
    states: { ...(node.states || {}), [state]: structuredClone(override) },
  };
}

export function removeNodeStateOverride(node: DesignNode, state: InteractionVisualState): DesignNode {
  const next = structuredClone(node);
  if (!next.states) return next;
  delete next.states[state];
  if (!Object.keys(next.states).length) delete next.states;
  if (next.previewState === state) delete next.previewState;
  return next;
}
