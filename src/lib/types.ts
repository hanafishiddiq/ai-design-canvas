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
export type LayoutMode = "absolute" | "horizontal" | "vertical";
export type SizingMode = "fixed" | "hug" | "fill";
export type LayoutAlign = "start" | "center" | "end" | "stretch";
export type LayoutJustify = "start" | "center" | "end" | "space-between";

export interface AutoLayoutSpec {
  mode: LayoutMode;
  gap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  align?: LayoutAlign;
  justify?: LayoutJustify;
  widthMode?: SizingMode;
  heightMode?: SizingMode;
  wrap?: boolean;
}

export interface ResponsiveConstraints {
  horizontal?: "left" | "right" | "left-right" | "center" | "scale";
  vertical?: "top" | "bottom" | "top-bottom" | "center" | "scale";
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  hiddenBelow?: number;
  hiddenAbove?: number;
}

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

export interface ComponentBinding {
  componentId: string;
  instanceId: string;
  sourceNodeId: string;
  overrides?: Record<string, unknown>;
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
  parentId?: string;
  children?: string[];
  layout?: AutoLayoutSpec;
  constraints?: ResponsiveConstraints;
  component?: ComponentBinding;
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

export interface ComponentDefinition {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  nodes: DesignNode[];
  createdAt: string;
  updatedAt: string;
}

export type VariableType = "color" | "number" | "string" | "boolean";
export interface DesignVariable {
  id: string;
  name: string;
  type: VariableType;
  values: Record<string, string | number | boolean>;
  description?: string;
}
export interface VariableCollection {
  id: string;
  name: string;
  modes: string[];
  defaultMode: string;
  variables: DesignVariable[];
}

export type ReferenceKind = "screenshot" | "sketch" | "moodboard" | "asset";
export interface ReferenceAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  averageColor: string;
  dominantColors: string[];
  luminance: number;
  contrast: "low" | "medium" | "high";
}
export interface DesignReference {
  id: string;
  name: string;
  kind: ReferenceKind;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
  notes?: string;
  analysis: ReferenceAnalysis;
}

export type ReviewStatus = "draft" | "in-review" | "changes-requested" | "approved";
export interface ReviewReply {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}
export interface ReviewThread {
  id: string;
  pageId: string;
  nodeId?: string;
  x?: number;
  y?: number;
  author: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  replies: ReviewReply[];
}
export interface ReviewState {
  status: ReviewStatus;
  threads: ReviewThread[];
}

export type CodeTarget = "react" | "nextjs" | "html" | "flutter" | "swiftui" | "react-native";
export interface CodeMapping {
  id: string;
  target: CodeTarget;
  pageId?: string;
  nodeId?: string;
  componentId?: string;
  filePath: string;
  symbol?: string;
  route?: string;
  repository?: string;
  sourceHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignProject {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  version: 5;
  direction: DesignDirection;
  tokens: DesignTokens;
  designMd: string;
  pages: DesignPage[];
  flows: FlowEdge[];
  components: Record<string, ComponentDefinition>;
  variables: VariableCollection[];
  references: DesignReference[];
  review: ReviewState;
  codeMappings: CodeMapping[];
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

/** Legacy bridge patch format kept for OpenPencil interoperability. */
export interface DesignPatch {
  pageId: string;
  nodeId?: string;
  changes: Record<string, unknown>;
}
