import type { InteractiveLabDefinition, LabAction, LabState, SceneObject } from "../types";
import { boxFaceAssembly } from "../fidelity/assemblies";
import { composeHighFidelity, recordCheckResult } from "../fidelity/engine";
import { HIGH_FIDELITY_SPEC_VERSION, type ExplanationLine, type FidelityState, type HighFidelitySpec } from "../fidelity/types";

const solids: SceneObject[] = [
  { id: "sphere", label: "Sphere", geometry: "sphere", transform: { position: [-4, 0, 0], rotation: [0, 0, 0], scale: [1.35, 1.35, 1.35] }, material: { color: "#4f8cff", roughness: .32, metalness: .08 } },
  { id: "cylinder", label: "Cylinder", geometry: "cylinder", transform: { position: [-2, 0, 0], rotation: [0, 0, 0], scale: [1, 1.4, 1] }, material: { color: "#f59e72", roughness: .38, metalness: .05 }, features: { faces: 3, edges: 2, vertices: 0 } },
  { id: "cone", label: "Cone", geometry: "cone", transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1.1, 1.35, 1.1] }, material: { color: "#8c6be8", roughness: .34, metalness: .05 }, features: { faces: 2, edges: 1, vertices: 1 } },
  { id: "cube", label: "Cube", geometry: "cube", transform: { position: [2.1, 0, 0], rotation: [.2, .45, 0], scale: [1.25, 1.25, 1.25] }, material: { color: "#32b5a5", roughness: .28, metalness: .08 }, features: { faces: 6, edges: 12, vertices: 8 }, net: { faceOrder: ["top", "front", "bottom", "back", "left", "right"], transforms: [] } },
  { id: "rectangular-prism", label: "Rectangular prism", geometry: "rectangular-prism", transform: { position: [4.5, 0, 0], rotation: [.18, -.35, 0], scale: [1.35, 1, .9] }, material: { color: "#e0b84d", roughness: .32, metalness: .05 }, features: { faces: 6, edges: 12, vertices: 8 }, net: { faceOrder: ["top", "front", "bottom", "back", "left", "right"], transforms: [] } },
];

export const SOLIDS_LAB_ID = "g4-solid-figures";
export const SOLIDS_OBJECTIVE_ID = "moe-math-g4-s2-p6-geometry-and-statistics-obj5";
export const SOLIDS_CONCEPT_ID = "g4-solid-figures-identification";
/** 2.1.0 adds the high-fidelity layer (explode, net, rebuild) and the rebuild-prism direct-manipulation check. */
export const SOLIDS_LAB_VERSION = "2.1.0";

export function initialSolidsState(): LabState {
  return { mode: "GUIDED", selectedObjectId: null, focusedObjectId: null, rotations: Object.fromEntries(solids.map((o) => [o.id, [...o.transform.rotation] as [number, number, number]])), highlightedFeatures: {}, netObjectIds: [], completedChecks: [], retries: 0, hints: 0, lastFeedback: null };
}

const FEATURE_COUNT_KEY = { face: "faces", edge: "edges", vertex: "vertices" } as const;

function validObject(id: string): boolean { return solids.some((object) => object.id === id); }

function validate(state: LabState, action: LabAction) {
  if (action.type === "select" || action.type === "focus" || action.type === "rotate" || action.type === "toggle-net") return validObject(action.objectId) ? { ok: true } : { ok: false, reason: "Unknown scene object." };
  if (action.type === "highlight-feature") {
    const object = solids.find((candidate) => candidate.id === action.objectId);
    const limit = object?.features?.[FEATURE_COUNT_KEY[action.feature]];
    return object && limit !== undefined && Number.isInteger(action.index) && action.index >= 0 && action.index < limit
      ? { ok: true } : { ok: false, reason: "Feature index is invalid for this object." };
  }
  if (action.type === "check") return ["select-sphere", "rotate-cube", "cube-vertices", "no-flat-faces", "circular-faces", "cube-v-prism"].includes(action.checkId)
    ? { ok: true } : { ok: false, reason: "Unknown learning check." };
  return { ok: true };
}

export function transitionSolids(state: LabState, action: LabAction): LabState {
  if (action.type === "reset") return initialSolidsState();
  if (action.type === "mode") return { ...state, mode: action.mode, lastFeedback: null };
  if (action.type === "select") return { ...state, selectedObjectId: action.objectId, lastFeedback: null };
  if (action.type === "focus") return { ...state, focusedObjectId: action.objectId, selectedObjectId: action.objectId, lastFeedback: null };
  if (action.type === "rotate") {
    const prior = state.rotations[action.objectId] ?? [0, 0, 0];
    return { ...state, rotations: { ...state.rotations, [action.objectId]: [prior[0] + action.delta[1], prior[1] + action.delta[0], prior[2]] }, lastFeedback: null };
  }
  if (action.type === "highlight-feature") {
    const prior = state.highlightedFeatures[action.objectId];
    const indices = prior?.kind === action.feature ? [...new Set([...prior.indices, action.index])] : [action.index];
    return { ...state, highlightedFeatures: { ...state.highlightedFeatures, [action.objectId]: { kind: action.feature, indices } }, lastFeedback: null };
  }
  if (action.type === "toggle-net") return { ...state, netObjectIds: state.netObjectIds.includes(action.objectId) ? state.netObjectIds.filter((id) => id !== action.objectId) : [...state.netObjectIds, action.objectId], lastFeedback: null };
  if (action.type === "check") {
    const checkId = action.checkId;
    const response = action.response as Record<string, unknown>;
    const correct = checkId === "select-sphere" ? state.selectedObjectId === "sphere" : checkId === "rotate-cube" ? Math.abs(state.rotations.cube?.[1] ?? 0) > .5 : checkId === "cube-vertices" ? (state.highlightedFeatures.cube?.indices.length ?? 0) === 8 : checkId === "no-flat-faces" ? state.selectedObjectId === "sphere" : checkId === "circular-faces" ? state.selectedObjectId === "cylinder" : checkId === "cube-v-prism" ? response.answer === "cube" : false;
    return recordCheckResult(state, SOLIDS_CHECKS, checkId, correct);
  }
  return state;
}

const SOLIDS_CHECKS: InteractiveLabDefinition<LabState>["checks"] = [
    { id: "select-sphere", prompt: "Select the solid with no flat faces.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "select", answer: { objectId: "sphere" }, hints: ["Think of a ball."] },
    { id: "rotate-cube", prompt: "Rotate the cube until a hidden face is visible.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "manipulate", answer: { objectId: "cube" }, hints: ["Drag the cube left or right."] },
    { id: "cube-vertices", prompt: "Tap all 8 vertices of the cube.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "feature", answer: { objectId: "cube", count: 8 }, hints: ["Corners are vertices."] },
    { id: "no-flat-faces", prompt: "Which solid has no flat faces?", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "select", answer: { objectId: "sphere" }, hints: [] },
    { id: "circular-faces", prompt: "Select a solid with circular faces.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "select", answer: { objectId: "cylinder" }, hints: [] },
    { id: "rebuild-prism", prompt: "Take the box (rectangular prism) apart, then rebuild it: put each face where a matching face fits.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "direct-manipulation", answer: { assemblyId: "prism-faces" }, fidelity: { kind: "assemble", assemblyId: "prism-faces" }, hints: ["Opposite faces of a box are the same size.", "Start with the two biggest faces: top and bottom."] },
    { id: "cube-v-prism", prompt: "Identify the cube in the scene.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "compare", answer: { objects: ["cube"] }, hints: ["A cube has six equal square faces."] },
];

const cubeFaces = boxFaceAssembly({ assemblyId: "cube-faces", label: "Cube faces", rootObjectId: "cube", half: [1.25, 1.25, 1.25], color: "#32b5a5", net: { poseId: "cube-net", variableId: "cube-unfold" } });
const prismFaces = boxFaceAssembly({ assemblyId: "prism-faces", label: "Rectangular prism faces", rootObjectId: "rectangular-prism", half: [1.25 * 1.35, 0.82, 0.72 * 0.9], color: "#e0b84d", build: { trayOrigin: [-3.6, -3.3, 0.8], traySpacing: [3.6, 2.1], order: ["left", "top", "back", "right", "bottom", "front"] } });

function explainSolids(state: FidelityState): ExplanationLine[] {
  const lines: ExplanationLine[] = [{ id: "cube-features", text: "A cube has 6 faces, 12 edges and 8 vertices." }];
  if ((state.explode["cube-faces"] ?? 0) > 0) lines.push({ id: "cube-exploded", text: "Taken apart, the cube is 6 flat faces. Every face is the same square." });
  if ((state.variables["cube-unfold"] ?? 0) >= 0.95) lines.push({ id: "cube-net", text: "Laid flat, the 6 squares make a net. Folding the net back up makes the cube." });
  if (state.disassembled.includes("prism-faces")) lines.push({ id: "prism-pairs", text: "A rectangular prism has 6 rectangle faces. Opposite faces match, so they come in 3 pairs." });
  return lines;
}

export const SOLIDS_FIDELITY: HighFidelitySpec = {
  specVersion: HIGH_FIDELITY_SPEC_VERSION,
  authoring: {
    learningObjective: "Identify solid figures and describe them by their faces, edges and vertices (MOE Grade 4, geometry objective 5).",
    whyInteractive: "Faces, edges and vertices are hidden in a picture. Turning, taking apart, unfolding and rebuilding a solid makes every part visible and countable.",
    scene: "Five solids in a row: sphere, cylinder, cone, cube and rectangular prism.",
    components: "The cube and the rectangular prism are each an assembly of six face panels.",
    internalStructures: "None. A solid figure is defined by its surface, so no cutaway is authored.",
    variables: "cube-unfold (0 to 1) folds the cube into its net and back.",
    simulationRules: "Structural only. Face transforms blend between the folded pose and the net pose; the exploded view moves each face out along its normal.",
    learnerControls: "Select, rotate, isolate, explode, the unfold slider, tapping vertices, taking the prism apart and placing faces into slots, camera presets.",
    visualConsequences: "Exploding separates the six faces. The slider unfolds the cube into a flat net. Each placed face moves into its slot on the prism.",
    guidedPath: "Overview, then explode the cube, then unfold it into a net, then rebuild the prism on the workbench.",
    exploreMode: "Free use of every control on any solid.",
    challenge: "Rebuild the rectangular prism from six unlabeled faces by matching their sizes.",
    assessment: "Select-by-property checks, a rotation check, tapping all 8 vertices, and the prism rebuild (direct manipulation).",
    evidence: "Only the Check action produces evidence. Rotating, exploding, unfolding and camera moves are observation only. Evidence stays PROVISIONAL or RAW_OBSERVATION until the governed release binding is approved.",
    misconceptions: "Treating a cube and a rectangular prism as the same; thinking a curved surface is a face; counting faces from a single view.",
    accessibility: "Every action has a button. Sliders have step buttons for keyboard use. Reduced motion snaps the animations. Labels can be toggled.",
    deviceProfile: "HIGH: full lighting and highlight pulses. STANDARD: simpler lighting. LOW: low-poly meshes, no pulses. FALLBACK_2D: SVG drawn from the same render list.",
    offlineFallback: "No remote assets; all geometry is procedural. FALLBACK_2D keeps every check completable.",
  },
  components: [...cubeFaces.components, ...prismFaces.components],
  assemblies: [cubeFaces.assembly, prismFaces.assembly],
  exploded: [{ ...cubeFaces.exploded, cameraPresetId: "cube-focus" }, prismFaces.exploded],
  cutaways: [],
  layers: [],
  poseTransitions: cubeFaces.pose ? [cubeFaces.pose] : [],
  variables: [{ id: "cube-unfold", label: "Unfold the cube", kind: "continuous", min: 0, max: 1, step: 0.05, initial: 0, learnerControlled: true, description: "Slide to unfold the cube into its net." }],
  flows: [],
  camera: {
    defaultPresetId: "overview",
    presets: [
      { id: "overview", label: "All solids", target: [0.25, 0, 0], distance: 11, yaw: 0, pitch: 0.08 },
      { id: "cube-focus", label: "Cube close-up", target: [2.1, 0, 0], distance: 10, yaw: -0.3, pitch: 0.28 },
      { id: "net-view", label: "Cube net", target: [2.1, -1.4, 0], distance: 14, yaw: 0, pitch: 0 },
      { id: "prism-workbench", label: "Prism workbench", target: [4.5, -2.6, 0], distance: 14, yaw: 0, pitch: 0.12 },
    ],
    constraints: { minDistance: 5, maxDistance: 18, minPitch: -0.6, maxPitch: 0.9, minYaw: -1.2, maxYaw: 1.2 },
  },
  guidedPath: [
    { id: "meet", prompt: "Meet five solids. Tap one to select it, then drag to turn it.", cameraPresetId: "overview" },
    { id: "explode", prompt: "Explode the cube. How many faces come apart?", cameraPresetId: "cube-focus", highlightIds: ["cube"] },
    { id: "unfold", prompt: "Slide to unfold the cube into a net, then fold it back.", cameraPresetId: "net-view" },
    { id: "rebuild", prompt: "Take the box apart and rebuild it. Match each face to a slot of the same size.", cameraPresetId: "prism-workbench", highlightIds: ["rectangular-prism"] },
  ],
  modes: ["GUIDED", "EXPLORE", "CHALLENGE", "ASSESSMENT"],
  explain: explainSolids,
  offline: { remoteAssets: [], maxPackageBytes: 64_000 },
};

const solidsBaseDefinition: InteractiveLabDefinition<LabState> = {
  contractVersion: "interactive-lab-definition/2.0.0", id: SOLIDS_LAB_ID, version: SOLIDS_LAB_VERSION, title: "Solid figures", summary: "Turn, take apart, unfold and rebuild real 3D solids. You will need to use the scene, not just guess, to complete the checks.", grade: 4, subject: "MATH",
  objectiveIds: [SOLIDS_OBJECTIVE_ID], conceptIds: [SOLIDS_CONCEPT_ID],
  releaseBinding: { releaseId: "lr-moe-g4-math-solids-2026.1", releaseIdentity: "pending-review", activityId: SOLIDS_LAB_ID, activityVersion: SOLIDS_LAB_VERSION },
  provenance: { source: "Liberia MOE Grade 1-6 Mathematics", reference: "curriculum/review/g4-math/unit-6.md", author: "LiberiaLearn platform review" },
  reviewState: "IN_REVIEW", approvalState: "PENDING",
  scene: { objects: solids, lighting: { ambient: "#93a4c5", key: "#fff2d0" }, camera: { fov: 42, minDistance: 5, maxDistance: 18 } },
  interactions: ["select", "rotate", "focus", "highlight", "isolate", "explode", "unfold", "assemble/disassemble", "reset", "answer/check"], initialState: initialSolidsState(), validateAction: validate, transition: transitionSolids,
  checks: SOLIDS_CHECKS, accessibility: { touch: true, keyboard: true, reducedMotion: true, offline: true, fallback: "FALLBACK_2D" },
};

export const solidsDefinition: InteractiveLabDefinition<LabState> = composeHighFidelity(solidsBaseDefinition, SOLIDS_FIDELITY);
