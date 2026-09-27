import type { InteractiveLabDefinition, LabState } from "../types";
import { initialSolidsState } from "./solids";

export const leverDefinition: InteractiveLabDefinition<LabState> = {
  contractVersion: "interactive-lab-definition/2.0.0", id: "fixture-lever", version: "2.0.0", grade: 4, subject: "SCIENCE", objectiveIds: ["fixture-lever-objective"], conceptIds: ["fixture-lever-force"],
  releaseBinding: { releaseId: "fixture-unreleased", releaseIdentity: "fixture", activityId: "fixture-lever", activityVersion: "2.0.0" }, provenance: { source: "runtime fixture", reference: "internal", author: "LiberiaLearn" }, reviewState: "DRAFT", approvalState: "PENDING",
  scene: { objects: [{ id: "lever", label: "Lever", geometry: "lever", transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, material: { color: "#ef8354", roughness: .4, metalness: 0 } }], lighting: { ambient: "#9aa8c7", key: "#fff1d0" }, camera: { fov: 42, minDistance: 4, maxDistance: 12 } },
  interactions: ["select", "rotate", "focus", "answer/check"], initialState: initialSolidsState(), validateAction: () => ({ ok: true }), transition: (state, action) => action.type === "reset" ? initialSolidsState() : state,
  checks: [{ id: "lever-balance", prompt: "Move the lever to balance the load.", objectiveId: "fixture-lever-objective", conceptId: "fixture-lever-force", kind: "manipulate", answer: { objectId: "lever" }, hints: [] }], accessibility: { touch: true, keyboard: true, reducedMotion: true, offline: false, fallback: "FALLBACK_2D" },
};
