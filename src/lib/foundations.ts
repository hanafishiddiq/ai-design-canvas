import type { DesignDirection, DesignTokens, FoundationId } from "./types";

export const foundations: Record<FoundationId, { name: string; description: string; traits: string[] }> = {
  linear: { name: "Linear", description: "Dense, quiet product UI with strong hierarchy and restrained surfaces.", traits: ["compact navigation", "subtle borders", "low visual noise", "precise hierarchy"] },
  stripe: { name: "Stripe", description: "Confident information design with crisp typography and clear semantic color.", traits: ["structured content", "clear status color", "strong data hierarchy", "roomy sections"] },
  vercel: { name: "Vercel", description: "Monochrome technical minimalism with decisive contrast and sharp spacing.", traits: ["monochrome base", "technical tone", "crisp dividers", "high contrast"] },
  attio: { name: "Attio", description: "Editorial composition with understated chrome and refined typography.", traits: ["editorial rhythm", "soft neutrals", "deliberate whitespace", "fine borders"] },
  raycast: { name: "Raycast", description: "Command-oriented interface with compact controls, depth and purposeful accent.", traits: ["command density", "dark surfaces", "keyboard-first", "subtle depth"] },
};

const accents: Record<FoundationId, string> = { linear: "#7c8cff", stripe: "#635bff", vercel: "#ffffff", attio: "#e36b46", raycast: "#ff6363" };
export const defaultDirection: DesignDirection = { foundation: "linear", treatment: "precision", density: "compact", radius: "soft", motion: "subtle", theme: "dark", accent: accents.linear };
export const foundationAccent = (id: FoundationId) => accents[id];

export function generateTokens(direction: DesignDirection): DesignTokens {
  const dark = direction.theme === "dark";
  const density = direction.density === "compact" ? 0.82 : direction.density === "comfortable" ? 1.18 : 1;
  const radiusBase = direction.radius === "sharp" ? 4 : direction.radius === "rounded" ? 16 : 9;
  const accent = direction.accent || accents[direction.foundation];
  const surface = direction.foundation === "attio" && !dark ? "#f7f5f2" : dark ? "#111318" : "#f7f7f8";
  const family = direction.treatment === "editorial" ? "Georgia, ui-serif, serif" : "Inter, ui-sans-serif, system-ui, sans-serif";
  const duration = direction.motion === "none" ? 0 : direction.motion === "snappy" ? 120 : 180;
  return {
    colors: { background: dark ? "#0b0c0f" : "#ffffff", surface, surfaceElevated: dark ? "#171a20" : "#ffffff", border: dark ? "#282c34" : "#dedfe3", text: dark ? "#f4f5f7" : "#111318", muted: dark ? "#959ca8" : "#667085", accent, accentText: direction.foundation === "vercel" && dark ? "#0b0c0f" : "#ffffff", success: "#35b778", warning: "#e8a23a", danger: "#ef6262" },
    typography: { fontFamily: family, displayFamily: family, baseSize: 14, scale: direction.treatment === "editorial" ? 1.24 : 1.18 },
    spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48].map((value) => Math.round(value * density)),
    radius: { sm: Math.max(2, radiusBase - 4), md: radiusBase, lg: radiusBase + 6, pill: 999 },
    motion: { duration, easing: direction.motion === "snappy" ? "cubic-bezier(.2,.8,.2,1)" : "ease" },
    density,
  };
}

export function directionIntent(direction: DesignDirection): string[] {
  const treatment = {
    precision: "Favor exact alignment, compact controls, and measurable hierarchy.",
    editorial: "Use editorial pacing, stronger type contrast, and fewer enclosing cards.",
    technical: "Prefer explicit structure, monospace accents, grids, and functional labels.",
    quiet: "Reduce decoration, use low-contrast chrome, and let content dominate.",
    expressive: "Allow controlled scale contrast and purposeful accent moments without decorative clutter.",
  } as const;
  return [
    `${foundations[direction.foundation].name} foundation: ${foundations[direction.foundation].description}`,
    treatment[direction.treatment],
    `Density is ${direction.density}; radius is ${direction.radius}; motion is ${direction.motion}.`,
    `Use ${direction.accent} as the principal accent, not as a decorative wash.`,
  ];
}
