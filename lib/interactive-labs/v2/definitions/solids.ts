import type { InteractiveLabDefinition, LabAction, LabState, SceneObject } from "../types";

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

export function initialSolidsState(): LabState {
  return { mode: "GUIDED", selectedObjectId: null, focusedObjectId: null, rotations: Object.fromEntries(solids.map((o) => [o.id, [...o.transform.rotation] as [number, number, number]])), highlightedFeatures: {}, netObjectIds: [], completedChecks: [], retries: 0, hints: 0, lastFeedback: null };
}

function validObject(id: string): boolean { return solids.some((object) => object.id === id); }

function validate(state: LabState, action: LabAction) {
  if (action.type === "select" || action.type === "focus" || action.type === "rotate" || action.type === "highlight-feature" || action.type === "toggle-net") return validObject(action.objectId) ? { ok: true } : { ok: false, reason: "Unknown scene object." };
  if (action.type === "check") return solids.some((object) => object.id === action.checkId || action.checkId.length > 0) ? { ok: true } : { ok: false, reason: "Unknown learning check." };
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
    return { ...state, completedChecks: correct && !state.completedChecks.includes(checkId) ? [...state.completedChecks, checkId] : state.completedChecks, retries: correct ? state.retries : state.retries + 1, lastFeedback: correct ? "correct" : "incorrect", mode: correct && checkId === "cube-v-prism" ? "COMPLETE" : state.mode };
  }
  return state;
}

export const solidsDefinition: InteractiveLabDefinition<LabState> = {
  contractVersion: "interactive-lab-definition/2.0.0", id: SOLIDS_LAB_ID, version: "2.0.0", grade: 4, subject: "MATH",
  objectiveIds: [SOLIDS_OBJECTIVE_ID], conceptIds: [SOLIDS_CONCEPT_ID],
  releaseBinding: { releaseId: "lr-moe-g4-math-solids-2026.1", releaseIdentity: "pending-review", activityId: SOLIDS_LAB_ID, activityVersion: "2.0.0" },
  provenance: { source: "Liberia MOE Grade 1-6 Mathematics", reference: "curriculum/review/g4-math/unit-6.md", author: "LiberiaLearn platform review" },
  reviewState: "IN_REVIEW", approvalState: "PENDING",
  scene: { objects: solids, lighting: { ambient: "#93a4c5", key: "#fff2d0" }, camera: { fov: 42, minDistance: 5, maxDistance: 16 } },
  interactions: ["select", "rotate", "focus", "highlight", "assemble/disassemble", "reset", "answer/check"], initialState: initialSolidsState(), validateAction: validate, transition: transitionSolids,
  checks: [
    { id: "select-sphere", prompt: "Select the solid with no flat faces.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "select", answer: { objectId: "sphere" }, hints: ["Think of a ball."] },
    { id: "rotate-cube", prompt: "Rotate the cube until a hidden face is visible.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "manipulate", answer: { objectId: "cube" }, hints: ["Drag the cube left or right."] },
    { id: "cube-vertices", prompt: "Tap all 8 vertices of the cube.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "feature", answer: { objectId: "cube", count: 8 }, hints: ["Corners are vertices."] },
    { id: "no-flat-faces", prompt: "Which solid has no flat faces?", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "select", answer: { objectId: "sphere" }, hints: [] },
    { id: "circular-faces", prompt: "Select a solid with circular faces.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "select", answer: { objectId: "cylinder" }, hints: [] },
    { id: "cube-v-prism", prompt: "Identify the cube in the scene.", objectiveId: SOLIDS_OBJECTIVE_ID, conceptId: SOLIDS_CONCEPT_ID, kind: "compare", answer: { objects: ["cube"] }, hints: ["A cube has six equal square faces."] },
  ], accessibility: { touch: true, keyboard: true, reducedMotion: true, offline: true, fallback: "FALLBACK_2D" },
};
