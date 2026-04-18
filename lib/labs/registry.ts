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
import {
  CIRCUIT_ACTION_TYPES,
  isElectricCircuitAction,
} from "@/lib/labs/electric-circuit/actions";
import {
  CIRCUIT_INITIAL_STATE,
  type ElectricCircuitState,
} from "@/lib/labs/electric-circuit/state";
import { applyElectricCircuitAction } from "@/lib/labs/electric-circuit/runtime";
import { validateElectricCircuitAction } from "@/lib/labs/electric-circuit/validator";
import { WAVE_ACTION_TYPES, isWaveMotionAction } from "@/lib/labs/wave-motion/actions";
import { WAVE_INITIAL_STATE, type WaveMotionState } from "@/lib/labs/wave-motion/state";
import { applyWaveMotionAction } from "@/lib/labs/wave-motion/runtime";
import { validateWaveMotionAction } from "@/lib/labs/wave-motion/validator";
import {
  CELL_DIVISION_ACTION_TYPES,
  isCellDivisionAction,
} from "@/lib/labs/cell-division/actions";
import {
  CELL_DIVISION_INITIAL_STATE,
  type CellDivisionState,
} from "@/lib/labs/cell-division/state";
import { applyCellDivisionAction } from "@/lib/labs/cell-division/runtime";
import { validateCellDivisionAction } from "@/lib/labs/cell-division/validator";
import {
  ECOSYSTEM_ACTION_TYPES,
  isEcosystemBalanceAction,
} from "@/lib/labs/ecosystem-balance/actions";
import {
  ECOSYSTEM_INITIAL_STATE,
  type EcosystemBalanceState,
} from "@/lib/labs/ecosystem-balance/state";
import { applyEcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/runtime";
import { validateEcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/validator";

export const LAB_IDS = [
  "gravity-explorer",
  "pendulum-lab",
  "molecule-motion",
  "human-heart",
  "electric-circuit",
  "wave-motion",
  "cell-division",
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

const electricCircuitDefinition: LabDefinition<ElectricCircuitState> = {
  id: "electric-circuit",
  title: "Electric Circuit Builder",
  subject: "Physics",
  gradeBand: "Grades 9-11",
  description: "Explore how voltage, resistance, and circuit type affect current and power.",
  tier: 1,
  curriculumStandards: ["Liberia Grade 10 Physics - Electricity and Circuits"],
  allowedActions: [...CIRCUIT_ACTION_TYPES],
  initialState: CIRCUIT_INITIAL_STATE,
  validateAction: (_state, action) => {
    if (!isElectricCircuitAction(action)) {
      return { ok: false, reason: "Action is not valid for Electric Circuit Builder." };
    }
    return validateElectricCircuitAction(action);
  },
  applyAction: (state, action) => {
    if (!isElectricCircuitAction(action)) {
      return state;
    }
    return applyElectricCircuitAction(state, action);
  },
};

const waveMotionDefinition: LabDefinition<WaveMotionState> = {
  id: "wave-motion",
  title: "Wave Motion Lab",
  subject: "Physics",
  gradeBand: "Grades 10-12",
  description: "Explore how frequency, amplitude, and wave speed affect wave behavior.",
  tier: 1,
  curriculumStandards: ["Liberia Grade 11 Physics - Waves and Oscillations"],
  allowedActions: [...WAVE_ACTION_TYPES],
  initialState: WAVE_INITIAL_STATE,
  validateAction: (_state, action) => {
    if (!isWaveMotionAction(action)) {
      return { ok: false, reason: "Action is not valid for Wave Motion Lab." };
    }
    return validateWaveMotionAction(action);
  },
  applyAction: (state, action) => {
    if (!isWaveMotionAction(action)) {
      return state;
    }
    return applyWaveMotionAction(state, action);
  },
};

const cellDivisionDefinition: LabDefinition<CellDivisionState> = {
  id: "cell-division",
  title: "Cell Division Explorer",
  subject: "Biology",
  gradeBand: "Grades 9-11",
  description: "Explore the stages of mitosis and how chromosomes divide.",
  tier: 1,
  curriculumStandards: ["Liberia Grade 10 Biology - Cell Reproduction and Mitosis"],
  allowedActions: [...CELL_DIVISION_ACTION_TYPES],
  initialState: CELL_DIVISION_INITIAL_STATE,
  validateAction: (_state, action) => {
    if (!isCellDivisionAction(action)) {
      return { ok: false, reason: "Action is not valid for Cell Division Explorer." };
    }
    return validateCellDivisionAction(action);
  },
  applyAction: (state, action) => {
    if (!isCellDivisionAction(action)) {
      return state;
    }
    return applyCellDivisionAction(state, action);
  },
};

const ecosystemBalanceDefinition: LabDefinition<EcosystemBalanceState> = {
  id: "ecosystem-balance",
  title: "Ecosystem Balance Lab",
  subject: "Biology",
  gradeBand: "Grades 7-9",
  description: "Explore predator-prey relationships and how populations interact in an ecosystem.",
  tier: 3,
  curriculumStandards: ["Liberia Grade 8 Biology - Ecosystems and Food Chains"],
  allowedActions: [...ECOSYSTEM_ACTION_TYPES],
  initialState: ECOSYSTEM_INITIAL_STATE,
  validateAction: (_state, action) => {
    if (!isEcosystemBalanceAction(action)) {
      return { ok: false, reason: "Action is not valid for Ecosystem Balance Lab." };
    }
    return validateEcosystemBalanceAction(action);
  },
  applyAction: (state, action) => {
    if (!isEcosystemBalanceAction(action)) {
      return state;
    }
    return applyEcosystemBalanceAction(state, action);
  },
};

export const labRegistry: Partial<Record<LabId, LabDefinition<unknown>>> = {
  "gravity-explorer": gravityExplorerDefinition as LabDefinition<unknown>,
  "pendulum-lab": pendulumLabDefinition as LabDefinition<unknown>,
  "molecule-motion": moleculeMotionDefinition as LabDefinition<unknown>,
  "human-heart": humanHeartDefinition as LabDefinition<unknown>,
  "electric-circuit": electricCircuitDefinition as LabDefinition<unknown>,
  "wave-motion": waveMotionDefinition as LabDefinition<unknown>,
  "cell-division": cellDivisionDefinition as LabDefinition<unknown>,
  "ecosystem-balance": ecosystemBalanceDefinition as LabDefinition<unknown>,
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
