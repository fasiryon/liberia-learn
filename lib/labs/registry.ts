import type { LabDefinition, LabId } from "@/lib/labs/types";
import { GRAVITY_ACTION_TYPES, isGravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import { GRAVITY_INITIAL_STATE, type GravityLabState } from "@/lib/labs/gravity-explorer/state";
import { applyGravityLabAction } from "@/lib/labs/gravity-explorer/runtime";
import { validateGravityLabAction } from "@/lib/labs/gravity-explorer/validator";

export const LAB_IDS = [
  "gravity-explorer",
  "pendulum-lab",
  "molecule-motion",
  "human-heart",
  "electric-circuits",
  "light-and-shadow",
  "simple-machines",
  "ecosystem-balance",
  "cell-structure",
  "chemical-reactions",
  "water-cycle",
  "earthquake-waves",
] as const satisfies readonly LabId[];

const gravityExplorerDefinition: LabDefinition<GravityLabState> = {
  id: "gravity-explorer",
  title: "Gravity Explorer",
  subject: "Physics",
  gradeBand: "Grades 7-9",
  description: "Explore how gravity affects falling motion.",
  tier: 1,
  curriculumStandards: ["Liberia Grade 8 Physics - Forces and Motion"],
  allowedActions: [...GRAVITY_ACTION_TYPES],
  initialState: GRAVITY_INITIAL_STATE,
  validateAction: (_state, action) => {
    if (!isGravityLabAction(action)) {
      return { ok: false, reason: "Action is not valid for Gravity Explorer." };
    }
    return validateGravityLabAction(action);
  },
  applyAction: (state, action) => {
    if (!isGravityLabAction(action)) {
      return state;
    }
    return applyGravityLabAction(state, action);
  },
};

export const labRegistry: Partial<Record<LabId, LabDefinition<unknown>>> = {
  "gravity-explorer": gravityExplorerDefinition as LabDefinition<unknown>,
};

export function isValidLabId(id: string): id is LabId {
  return (LAB_IDS as readonly string[]).includes(id);
}

export function getLabDefinition(labId: string): LabDefinition<unknown> {
  if (!isValidLabId(labId)) {
    throw new Error(`Unknown lab id: ${labId}`);
  }

  const definition = labRegistry[labId];
  if (!definition) {
    throw new Error(`Lab is not registered: ${labId}`);
  }

  return definition;
}
