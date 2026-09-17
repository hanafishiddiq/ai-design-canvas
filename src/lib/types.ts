export type FoundationId = "linear" | "stripe" | "vercel" | "attio" | "raycast";
export type TreatmentId = "precision" | "editorial" | "technical" | "quiet" | "expressive";
export type DensityId = "compact" | "balanced" | "comfortable";
export type RadiusId = "sharp" | "soft" | "rounded";
export type MotionId = "none" | "subtle" | "snappy";
export type ThemeId = "dark" | "light";

export interface DesignDirection {
  foundation: FoundationId;
  treatment: TreatmentId;
  density: DensityId;
  radius: RadiusId;
  motion: MotionId;
  theme: ThemeId;
  accent: string;
}

export interface DesignTokens {
  colors: {
    background: string;
    surface: string;
    surfaceElevated: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    success: string;
    warning: string;
    danger: string;
  };
  typography: { fontFamily: string; displayFamily: string; baseSize: number; scale: number };
  spacing: number[];
  radius: { sm: number; md: number; lg: number; pill: number };
  motion: { duration: number; easing: string };
  density: number;
}

export type NodeType = "frame" | "text" | "button" | "card" | "metric" | "list" | "input" | "divider";
export interface NodeStyle {
  background?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  padding?: number;
  gap?: number;
  fontSize?: number;
  fontWeight?: number;
  opacity?: number;
  align?: "left" | "center" | "right";
}
export interface DesignNode {
  id: string;
  type: NodeType;
  name: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: NodeStyle;
  children?: string[];
  action?: { type: "navigate"; targetPageId: string };
}
export interface DesignPage {
  id: string;
  name: string;
  route: string;
  x: number;
  y: number;
  width: number;
  height: number;
  background: string;
  nodes: DesignNode[];
}
export interface FlowEdge {
  id: string;
  fromPageId: string;
  fromNodeId: string;
  toPageId: string;
  label: string;
}
export interface DesignProject {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  version: 1;
  direction: DesignDirection;
  tokens: DesignTokens;
  designMd: string;
  pages: DesignPage[];
  flows: FlowEdge[];
  activePageId: string;
}
export type AuditSeverity = "info" | "warning" | "error";
export interface AuditIssue {
  id: string;
  rule: string;
  severity: AuditSeverity;
  message: string;
  pageId: string;
  nodeId?: string;
  suggestion: string;
}
export interface DesignPatch {
  pageId: string;
  nodeId?: string;
  changes: Record<string, unknown>;
}
