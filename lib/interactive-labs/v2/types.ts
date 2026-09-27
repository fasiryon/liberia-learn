export const INTERACTIVE_LAB_DEFINITION_VERSION = "interactive-lab-definition/2.0.0" as const;

export type CapabilityProfile = "HIGH" | "STANDARD" | "LOW" | "FALLBACK_2D";
export type LabMode = "GUIDED" | "EXPLORE" | "CHALLENGE" | "ASSESSMENT" | "COMPLETE";
export type GeometryKind = "sphere" | "cylinder" | "cone" | "cube" | "rectangular-prism" | "lever";
export type FeatureKind = "face" | "edge" | "vertex";

export type Transform = { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] };
export type MaterialSpec = { color: string; roughness: number; metalness: number; opacity?: number };
export type SceneObject = {
  id: string;
  label: string;
  geometry: GeometryKind;
  transform: Transform;
  material: MaterialSpec;
  selectable?: boolean;
  features?: { faces?: number; edges?: number; vertices?: number };
  net?: { faceOrder: string[]; transforms: Transform[] };
};

export type LearningCheck = {
  id: string;
  prompt: string;
  objectiveId: string;
  conceptId: string;
  kind: "select" | "manipulate" | "feature" | "compare";
  answer: Record<string, unknown>;
  hints: string[];
};

export type InteractiveLabDefinition<S = Record<string, unknown>> = {
  contractVersion: typeof INTERACTIVE_LAB_DEFINITION_VERSION;
  id: string;
  version: string;
  grade: number;
  subject: string;
  objectiveIds: string[];
  conceptIds: string[];
  releaseBinding: { releaseId: string; releaseIdentity: string; activityId: string; activityVersion: string };
  provenance: { source: string; reference: string; author: string };
  reviewState: "DRAFT" | "IN_REVIEW" | "APPROVED";
  approvalState: "PENDING" | "APPROVED";
  scene: { objects: SceneObject[]; lighting: { ambient: string; key: string }; camera: { fov: number; minDistance: number; maxDistance: number } };
  interactions: string[];
  initialState: S;
  validateAction: (state: S, action: LabAction) => { ok: boolean; reason?: string };
  transition: (state: S, action: LabAction) => S;
  checks: LearningCheck[];
  accessibility: { touch: boolean; keyboard: boolean; reducedMotion: boolean; offline: boolean; fallback: CapabilityProfile };
};

export type LabAction =
  | { type: "select"; objectId: string }
  | { type: "rotate"; objectId: string; delta: [number, number] }
  | { type: "focus"; objectId: string }
  | { type: "highlight-feature"; objectId: string; feature: FeatureKind; index: number }
  | { type: "toggle-net"; objectId: string }
  | { type: "mode"; mode: Exclude<LabMode, "COMPLETE"> }
  | { type: "check"; checkId: string; response: Record<string, unknown> }
  | { type: "reset" };

export type LabState = {
  mode: LabMode;
  selectedObjectId: string | null;
  focusedObjectId: string | null;
  rotations: Record<string, [number, number, number]>;
  highlightedFeatures: Record<string, { kind: FeatureKind; indices: number[] }>;
  netObjectIds: string[];
  completedChecks: string[];
  retries: number;
  hints: number;
  lastFeedback: "correct" | "incorrect" | null;
};

export type LabSessionCheckpoint = {
  sessionId: string;
  labId: string;
  labVersion: string;
  learnerId: string;
  tenantId: string;
  mode: LabMode;
  completedChecks: string[];
  retries: number;
  hints: number;
  state: LabState;
  updatedAt: string;
};
