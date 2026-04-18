import { getLabDefinition } from "@/lib/labs/registry";
import { isCellDivisionAction } from "@/lib/labs/cell-division/actions";
import { validateCellDivisionAction } from "@/lib/labs/cell-division/validator";
import { isElectricCircuitAction } from "@/lib/labs/electric-circuit/actions";
import { validateElectricCircuitAction } from "@/lib/labs/electric-circuit/validator";
import { isEcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/actions";
import { validateEcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/validator";
import { isGravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import { validateGravityLabAction } from "@/lib/labs/gravity-explorer/validator";
import { isHumanHeartAction } from "@/lib/labs/human-heart/actions";
import { validateHumanHeartAction } from "@/lib/labs/human-heart/validator";
import { isMoleculeMotionAction } from "@/lib/labs/molecule-motion/actions";
import { validateMoleculeMotionAction } from "@/lib/labs/molecule-motion/validator";
import { isPendulumLabAction } from "@/lib/labs/pendulum-lab/actions";
import { validatePendulumLabAction } from "@/lib/labs/pendulum-lab/validator";
import { isWaveMotionAction } from "@/lib/labs/wave-motion/actions";
import { validateWaveMotionAction } from "@/lib/labs/wave-motion/validator";
import type { LabAction, LabId, LabValidationResult } from "@/lib/labs/types";

export function validateLabAction<S>(
  labId: LabId,
  state: S,
  action: LabAction
): LabValidationResult {
  if (labId === "gravity-explorer") {
    return isGravityLabAction(action)
      ? validateGravityLabAction(action)
      : { ok: false, reason: "Action is not valid for Gravity Explorer." };
  }

  if (labId === "pendulum-lab") {
    return isPendulumLabAction(action)
      ? validatePendulumLabAction(action)
      : { ok: false, reason: "Action is not valid for Pendulum Lab." };
  }

  if (labId === "molecule-motion") {
    return isMoleculeMotionAction(action)
      ? validateMoleculeMotionAction(action)
      : { ok: false, reason: "Action is not valid for Molecule Motion Lab." };
  }

  if (labId === "human-heart") {
    return isHumanHeartAction(action)
      ? validateHumanHeartAction(action)
      : { ok: false, reason: "Action is not valid for Human Heart Simulator." };
  }

  if (labId === "electric-circuit") {
    return isElectricCircuitAction(action)
      ? validateElectricCircuitAction(action)
      : { ok: false, reason: "Action is not valid for Electric Circuit Builder." };
  }

  if (labId === "wave-motion") {
    return isWaveMotionAction(action)
      ? validateWaveMotionAction(action)
      : { ok: false, reason: "Action is not valid for Wave Motion Lab." };
  }

  if (labId === "cell-division") {
    return isCellDivisionAction(action)
      ? validateCellDivisionAction(action)
      : { ok: false, reason: "Action is not valid for Cell Division Explorer." };
  }

  if (labId === "ecosystem-balance") {
    return isEcosystemBalanceAction(action)
      ? validateEcosystemBalanceAction(action)
      : { ok: false, reason: "Action is not valid for Ecosystem Balance Lab." };
  }

  const definition = getLabDefinition(labId);
  return definition.validateAction(state, action);
}
