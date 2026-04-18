import type { LabDefinition, LabId } from "@/lib/labs/types";
import { GRAVITY_ACTION_TYPES, isGravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import { GRAVITY_INITIAL_STATE, type GravityLabState } from "@/lib/labs/gravity-explorer/state";
import { applyGravityLabAction } from "@/lib/labs/gravity-explorer/runtime";
import { validateGravityLabAction } from "@/lib/labs/gravity-explorer/validator";
import { PENDULUM_ACTION_TYPES, isPendulumLabAction } from "@/lib/labs/pendulum-lab/actions";
import {
  PENDULUM_INITIAL_STATE,
  type PendulumLabState,
} from "@/lib/labs/pendulum-lab/state";
import { applyPendulumLabAction } from "@/lib/labs/pendulum-lab/runtime";
import { validatePendulumLabAction } from "@/lib/labs/pendulum-lab/validator";
import {
  MOLECULE_ACTION_TYPES,
  isMoleculeMotionAction,
} from "@/lib/labs/molecule-motion/actions";
import {
  MOLECULE_INITIAL_STATE,
  type MoleculeMotionState,
} from "@/lib/labs/molecule-motion/state";
import { applyMoleculeMotionAction } from "@/lib/labs/molecule-motion/runtime";
import { validateMoleculeMotionAction } from "@/lib/labs/molecule-motion/validator";
import { HEART_ACTION_TYPES, isHumanHeartAction } from "@/lib/labs/human-heart/actions";
import { HEART_INITIAL_STATE, type HumanHeartState } from "@/lib/labs/human-heart/state";
import { applyHumanHeartAction } from "@/lib/labs/human-heart/runtime";
import { validateHumanHeartAction } from "@/lib/labs/human-heart/validator";

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

const pendulumLabDefinition: LabDefinition<PendulumLabState> = {
  id: "pendulum-lab",
  title: "Pendulum Lab",
  subject: "Physics",
  gradeBand: "Grades 7-9",
  description: "Explore how length and angle affect pendulum motion.",
  tier: 1,
  curriculumStandards: ["Liberia Grade 8 Physics - Oscillation and Waves"],
  allowedActions: [...PENDULUM_ACTION_TYPES],
  initialState: PENDULUM_INITIAL_STATE,
  validateAction: (_state, action) => {
    if (!isPendulumLabAction(action)) {
      return { ok: false, reason: "Action is not valid for Pendulum Lab." };
    }
    return validatePendulumLabAction(action);
  },
  applyAction: (state, action) => {
    if (!isPendulumLabAction(action)) {
      return state;
    }
    return applyPendulumLabAction(state, action);
  },
};

const moleculeMotionDefinition: LabDefinition<MoleculeMotionState> = {
  id: "molecule-motion",
  title: "Molecule Motion Lab",
  subject: "Chemistry",
  gradeBand: "Grades 9-11",
  description: "Explore how temperature affects particle motion and phase transitions.",
  tier: 1,
  curriculumStandards: ["Liberia Grade 10 Chemistry - Kinetic Molecular Theory"],
  allowedActions: [...MOLECULE_ACTION_TYPES],
  initialState: MOLECULE_INITIAL_STATE,
  validateAction: (_state, action) => {
    if (!isMoleculeMotionAction(action)) {
      return { ok: false, reason: "Action is not valid for Molecule Motion Lab." };
    }
    return validateMoleculeMotionAction(action);
  },
  applyAction: (state, action) => {
    if (!isMoleculeMotionAction(action)) {
      return state;
    }
    return applyMoleculeMotionAction(state, action);
  },
};

const humanHeartDefinition: LabDefinition<HumanHeartState> = {
  id: "human-heart",
  title: "Human Heart Simulator",
  subject: "Biology",
  gradeBand: "Grades 8-10",
  description: "Explore how heart rate, exercise, and blockages affect blood flow and oxygen delivery.",
  tier: 2,
  curriculumStandards: ["Liberia Grade 9 Biology - Circulatory System"],
  allowedActions: [...HEART_ACTION_TYPES],
  initialState: HEART_INITIAL_STATE,
  validateAction: (_state, action) => {
    if (!isHumanHeartAction(action)) {
      return { ok: false, reason: "Action is not valid for Human Heart Simulator." };
    }
    return validateHumanHeartAction(action);
  },
  applyAction: (state, action) => {
    if (!isHumanHeartAction(action)) {
      return state;
    }
    return applyHumanHeartAction(state, action);
  },
};

export const labRegistry: Partial<Record<LabId, LabDefinition<unknown>>> = {
  "gravity-explorer": gravityExplorerDefinition as LabDefinition<unknown>,
  "pendulum-lab": pendulumLabDefinition as LabDefinition<unknown>,
  "molecule-motion": moleculeMotionDefinition as LabDefinition<unknown>,
  "human-heart": humanHeartDefinition as LabDefinition<unknown>,
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
