// High-fidelity interactive lab contract (see docs/architecture/HIGH_FIDELITY_INTERACTIVE_LABS.md).
// Scene -> Components -> Rules -> Controls -> State -> Visual consequence -> Explanation -> Learning check -> Governed evidence.
// Everything here is data or a pure function so the same definition drives HIGH/STANDARD/LOW WebGL and FALLBACK_2D.
import type { GeometryKind, LabMode, MaterialSpec, Transform } from "../types";
import type { Vec3 } from "./math";

export const HIGH_FIDELITY_SPEC_VERSION = "high-fidelity-lab/1.0.0" as const;

/** A meaningful part of a system. Transforms are local to the assembly root object (if any), otherwise world space. */
export type ComponentDefinition = {
  id: string;
  label: string;
  description?: string;
  geometry: GeometryKind;
  transform: Transform;
  material: MaterialSpec;
  /** Internal structures stay hidden until a cutaway reveals them. */
  internal?: boolean;
  layerId?: string;
  selectable?: boolean;
  /** Assembly slot matching key (e.g. face size). */
  shapeKey?: string;
  ports?: { id: string; position: Vec3 }[];
  /** Non-instructional scenery. LOW may omit it; it must never carry state or interaction. */
  detail?: "decor";
  /** Decorative components cannot expose instructional text. */
  showLabel?: boolean;
  /** Suppress secondary callouts on narrow screens; controls retain the complete component inventory. */
  mobileLabel?: boolean;
  /** World-space offset for a visible scene label when nearby parts need separate callouts. */
  labelOffset?: Vec3;
  carriesSymbol?: boolean;
  carriesScale?: boolean;
  carriesPlaceIdentity?: boolean;
};

export type ComponentMotionDefinition = {
  id: string;
  label: string;
  componentIds: string[];
  /** Shared pivot in the components' root frame, or world space without a root object. */
  pivot: Vec3;
  axis: "x" | "y" | "z";
  rpm: number;
  symmetryOrder: number;
  activeWhen: { componentId: string; statuses: string[] };
};

export type AssemblySlot = { id: string; label: string; accepts: string; transform: Transform; initialComponentId: string };

/** Parent/child assembly. When the assembly is "open", its components replace the root scene object. */
export type ComponentAssemblyDefinition = {
  id: string;
  label: string;
  rootObjectId?: string;
  componentIds: string[];
  /** Slots make the assembly buildable: a component sits at the slot transform when placed. */
  slots?: AssemblySlot[];
  dependencies?: { from: string; to: string; label: string }[];
};

export type ExplodedViewDefinition = { assemblyId: string; offsets: Record<string, Vec3>; cameraPresetId?: string };

export type CutawayDefinition = {
  id: string;
  label: string;
  /** World-space clip plane; fragments with dot(normal, p) > offset are cut away where the device supports clipping. */
  plane: { normal: Vec3; offset: number };
  removesComponentIds: string[];
  revealsComponentIds: string[];
  cameraPresetId?: string;
};

export type LayerDefinition = { id: string; label: string; defaultVisible: boolean };

/** Variable-driven blend between two named poses of an assembly (nets, opening valves, folding). */
export type PoseTransitionDefinition = {
  id: string;
  assemblyId: string;
  variableId: string;
  from: Record<string, Transform>;
  to: Record<string, Transform>;
};

export type VariableDefinition = {
  id: string;
  label: string;
  unit?: string;
  kind: "continuous" | "discrete" | "toggle";
  min: number;
  max: number;
  step: number;
  initial: number;
  learnerControlled: boolean;
  description?: string;
};

export type SimulationInput = Readonly<{ variables: Readonly<Record<string, number>>; placements: Readonly<Record<string, Readonly<Record<string, string>>>> }>;
export type ExplanationLine = { id: string; text: string; minGrade?: number };
export type SimulationOutput = {
  quantities: Record<string, number>;
  flows: Record<string, { active: boolean; rate: number; direction: 1 | -1 }>;
  componentStates: Record<string, { intensity?: number; status?: string; color?: string; alpha?: number; pose?: number }>;
  explanation: ExplanationLine[];
};

/** Simulation rules are separate from the renderer and from evidence: a pure, deterministic function of state. */
export type SimulationModel = {
  id: string;
  version: string;
  kind: "deterministic-rules" | "equation" | "state-machine";
  evaluate: (input: SimulationInput) => SimulationOutput;
};

export type FlowMedium = "electric-current" | "blood" | "water" | "air" | "fuel" | "heat" | "light" | "nutrients" | "force";
export type FlowNode = { id: string; label: string; position: Vec3; componentId?: string; traceable?: boolean };
/** A governed visual flow. The simulation decides active/rate/direction; the renderer only draws it. */
export type FlowDefinition = {
  id: string;
  label: string;
  medium: FlowMedium;
  sourceNodeId: string;
  destinationNodeId: string;
  /** Ordered path from source through intermediate nodes to destination. */
  nodes: FlowNode[];
  closedLoop: boolean;
  visibleByDefault: boolean;
  color: string;
};

export type CameraPreset = { id: string; label: string; target: Vec3; distance: number; yaw: number; pitch: number };
export type CameraConstraints = { minDistance: number; maxDistance: number; minPitch: number; maxPitch: number; minYaw: number; maxYaw: number };

export type GuidedStep = { id: string; prompt: string; cameraPresetId?: string; highlightIds?: string[] };

/** Direct-manipulation learning checks. Evaluated from scene state, never from a free-text claim. */
export type FidelityCheck =
  | { kind: "reach-target"; quantityId: string; min: number; max: number }
  | { kind: "trace-path"; flowId: string }
  | { kind: "assemble"; assemblyId: string }
  | { kind: "identify-component"; componentId: string };

export type HighFidelityAuthoringRecord = {
  learningObjective: string;
  whyInteractive: string;
  scene: string;
  components: string;
  internalStructures: string;
  variables: string;
  simulationRules: string;
  learnerControls: string;
  visualConsequences: string;
  guidedPath: string;
  exploreMode: string;
  challenge: string;
  assessment: string;
  evidence: string;
  misconceptions: string;
  accessibility: string;
  deviceProfile: string;
  offlineFallback: string;
};

export type HighFidelitySpec = {
  specVersion: typeof HIGH_FIDELITY_SPEC_VERSION;
  authoring: HighFidelityAuthoringRecord;
  components: ComponentDefinition[];
  assemblies: ComponentAssemblyDefinition[];
  exploded: ExplodedViewDefinition[];
  cutaways: CutawayDefinition[];
  layers: LayerDefinition[];
  poseTransitions: PoseTransitionDefinition[];
  variables: VariableDefinition[];
  simulation?: SimulationModel;
  motions?: ComponentMotionDefinition[];
  flows: FlowDefinition[];
  camera: { defaultPresetId: string; presets: CameraPreset[]; constraints: CameraConstraints };
  guidedPath: GuidedStep[];
  modes: Exclude<LabMode, "COMPLETE">[];
  /** Optional live feedback for the active challenge, derived only from simulation quantities. */
  challengeStatus?: (quantities: Record<string, number>) => string;
  /** Grade-appropriate explanation for structural labs without a simulation model. */
  explain?: (state: FidelityState) => ExplanationLine[];
  offline: { remoteAssets: string[]; maxPackageBytes: number };
};

export type FidelityState = {
  variables: Record<string, number>;
  explode: Record<string, number>;
  activeCutawayId: string | null;
  hiddenLayerIds: string[];
  isolatedId: string | null;
  labelsVisible: boolean;
  cameraPresetId: string;
  placements: Record<string, Record<string, string>>;
  disassembled: string[];
  tracedPaths: Record<string, string[]>;
  inspectedComponentId: string | null;
  guidedStepIndex: number;
  hiddenFlowIds: string[];
};

export type FidelityAction =
  | { type: "set-variable"; variableId: string; value: number }
  | { type: "set-explode"; assemblyId: string; factor: number }
  | { type: "set-cutaway"; cutawayId: string | null }
  | { type: "toggle-layer"; layerId: string }
  | { type: "isolate"; targetId: string | null }
  | { type: "toggle-labels" }
  | { type: "camera-preset"; presetId: string }
  | { type: "clear-assembly"; assemblyId: string }
  | { type: "place-component"; assemblyId: string; slotId: string; componentId: string | null }
  | { type: "trace-node"; flowId: string; nodeId: string }
  | { type: "clear-trace"; flowId: string }
  | { type: "inspect-component"; componentId: string }
  | { type: "guided-step"; index: number }
  | { type: "toggle-flow"; flowId: string };

export const FIDELITY_ACTION_TYPES = Object.freeze(["set-variable", "set-explode", "set-cutaway", "toggle-layer", "isolate", "toggle-labels", "camera-preset", "clear-assembly", "place-component", "trace-node", "clear-trace", "inspect-component", "guided-step", "toggle-flow"] as const);
