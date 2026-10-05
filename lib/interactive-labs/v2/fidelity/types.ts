// High-fidelity interactive lab contract (see docs/architecture/HIGH_FIDELITY_INTERACTIVE_LABS.md).
// Scene -> Components -> Rules -> Controls -> State -> Visual consequence -> Explanation -> Learning check -> Governed evidence.
// Everything here is data or a pure function so the same definition drives HIGH/STANDARD/LOW WebGL and FALLBACK_2D.
import type { GeometryKind, LabMode, MaterialSpec, Transform } from "../types";
import type { Vec3 } from "./math";
import type { InstructionalGeometryVariants } from "./geometry/types";
import type { SurfaceDefinition } from "./surfaces";
import type { SceneControl } from "./controls";
import type { EmitterDefinition } from "./emitters";

export const HIGH_FIDELITY_SPEC_VERSION = "high-fidelity-lab/1.0.0" as const;

/** A meaningful part of a system. Transforms are local to the assembly root object (if any), otherwise world space. */
export type ComponentDefinition = {
  id: string;
  label: string;
  description?: string;
  geometry: GeometryKind;
  /** Parametric replacement for the primitive mesh; all four profile mappings are mandatory. */
  geometryVariants?: InstructionalGeometryVariants;
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
  /** RX-005c: an in-scene control. Activating the part dispatches the same set-variable as its panel twin. */
  control?: SceneControl;
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
  /** Component shown when a component-based assembly is closed. */
  rootComponentId?: string;
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
  /** fill (0–1) draws a part at that fraction of its length along x, anchored at its left end (e.g. a gauge segment). */
  componentStates: Record<string, { intensity?: number; status?: string; color?: string; alpha?: number; pose?: number; fill?: number }>;
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

/** RX-005d: `frame` refits the preset's target and distance to these parts for any aspect ratio (and frames 2D). */
export type CameraPreset = { id: string; label: string; target: Vec3; distance: number; yaw: number; pitch: number; frame?: { componentIds: string[] } };
/**
 * RX-005d / A16 camera limits. Without a `targetBox` the target follows presets only (no panning); with one, the
 * learner may pan inside it. `groundY` keeps the camera above the declared ground or water. `guided` limits how far
 * the learner may orbit away from a guided step's preset (they can always Recentre).
 */
export type CameraConstraints = { minDistance: number; maxDistance: number; minPitch: number; maxPitch: number; minYaw: number; maxYaw: number; targetBox?: { min: Vec3; max: Vec3 }; groundY?: number; guided?: { distance: number; yaw: number; pitch: number } };
/** RX-005d: an ordered camera tour. Presentation only: each stop is a camera-preset, advanced by the learner. */
export type CameraRail = { id: string; label: string; stops: { presetId: string; durationMs?: number; easing?: "ease-in-out" | "linear" }[] };

/** `variables` puts the step in its intended state (validated like a mode start), so a step never inherits a trip. */
export type GuidedStep = { id: string; prompt: string; cameraPresetId?: string; railId?: string; highlightIds?: string[]; variables?: Record<string, number> };

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
  camera: { defaultPresetId: string; presets: CameraPreset[]; constraints: CameraConstraints; rails?: CameraRail[] };
  guidedPath: GuidedStep[];
  modes: Exclude<LabMode, "COMPLETE">[];
  /** Optional live feedback for the active challenge, derived only from simulation quantities. */
  challengeStatus?: (quantities: Record<string, number>) => string;
  /** Grade-appropriate explanation for structural labs without a simulation model. */
  explain?: (state: FidelityState) => ExplanationLine[];
  offline: { remoteAssets: string[]; maxPackageBytes: number };
  /** Shared presentation intent. Existing labs default to STUDIO. */
  environment?: "DAYLIGHT" | "STUDIO";
  /** RX-005b: quantity-bound water (or other medium) surfaces. */
  surfaces?: SurfaceDefinition[];
  /** RX-005b: quantity-bound emitters (stream, spray, upwell, bubble, pulse). */
  emitters?: EmitterDefinition[];
  /**
   * Where a mode starts: entering the mode sets these learner variables and camera preset (validated like any
   * set-variable). Lets a challenge start under-loaded and an assessment start fresh instead of inheriting a solved state.
   */
  modeStart?: Partial<Record<LabMode, { variables?: Record<string, number>; cameraPresetId?: string }>>;
  /** RX-005e / A17: model quantities shown as always-visible scene chips (same on every profile). */
  hud?: { quantityId: string; label: string; unit?: string; digits?: number }[];
  /** Optional state banner for the HUD (e.g. "Tripped: the city is dark"). */
  hudAlert?: (quantities: Record<string, number>) => { text: string; tone: "danger" | "ok" | "info" } | null;
  /** Latched protection (a plant trip, a fuse): see ProtectionDefinition. */
  protection?: ProtectionDefinition;
};

/**
 * A latched protection. Whenever a state change makes the overload quantity 1, the engine sets the latch variable to 1
 * and leaves every learner choice as it was. Nothing clears the latch except an explicit reset-protection action,
 * which the engine accepts only while resetBlocker returns null. The model reads the latch and keeps the supply off.
 */
export type ProtectionDefinition = {
  /** Non-learner toggle variable (0/1, initial 0) that holds the latch. */
  latchVariableId: string;
  /** Simulation quantity that is 1 while the present conditions are an overload, whatever the latch says. */
  overloadQuantityId: string;
  /** Learner-facing name of the reset control, e.g. "Reset plant". */
  resetLabel: string;
  /** Why a reset would fail for these quantities (learner-facing), or null when it is safe. */
  resetBlocker: (quantities: Record<string, number>) => string | null;
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
  | { type: "toggle-flow"; flowId: string }
  | { type: "reset-protection" };

export const FIDELITY_ACTION_TYPES = Object.freeze(["set-variable", "set-explode", "set-cutaway", "toggle-layer", "isolate", "toggle-labels", "camera-preset", "clear-assembly", "place-component", "trace-node", "clear-trace", "inspect-component", "guided-step", "toggle-flow", "reset-protection"] as const);
