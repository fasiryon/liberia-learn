import { getLabDefinition } from "@/lib/labs/registry";
import { isCellDivisionAction } from "@/lib/labs/cell-division/actions";
import {
  applyCellDivisionAction,
  isCellDivisionState,
} from "@/lib/labs/cell-division/runtime";
import { isGravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import { applyGravityLabAction } from "@/lib/labs/gravity-explorer/runtime";
import { isGravityLabState } from "@/lib/labs/gravity-explorer/runtime";
import { isElectricCircuitAction } from "@/lib/labs/electric-circuit/actions";
import {
  applyElectricCircuitAction,
  isElectricCircuitState,
} from "@/lib/labs/electric-circuit/runtime";
import { isEcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/actions";
import {
  applyEcosystemBalanceAction,
  isEcosystemBalanceState,
} from "@/lib/labs/ecosystem-balance/runtime";
import { isChemicalReactionAction } from "@/lib/labs/chemical-reaction/actions";
import {
  applyChemicalReactionAction,
  isChemicalReactionState,
} from "@/lib/labs/chemical-reaction/runtime";
import { isHumanHeartAction } from "@/lib/labs/human-heart/actions";
import { applyHumanHeartAction, isHumanHeartState } from "@/lib/labs/human-heart/runtime";
import { isMoleculeMotionAction } from "@/lib/labs/molecule-motion/actions";
import {
  applyMoleculeMotionAction,
  isMoleculeMotionState,
} from "@/lib/labs/molecule-motion/runtime";
import { isPendulumLabAction } from "@/lib/labs/pendulum-lab/actions";
import { applyPendulumLabAction, isPendulumLabState } from "@/lib/labs/pendulum-lab/runtime";
import { isWaveMotionAction } from "@/lib/labs/wave-motion/actions";
import { applyWaveMotionAction, isWaveMotionState } from "@/lib/labs/wave-motion/runtime";
import { isPeriodicTableAction } from "@/lib/labs/periodic-table/actions";
import {
  applyPeriodicTableAction,
  isPeriodicTableState,
} from "@/lib/labs/periodic-table/runtime";
import { isWeatherSystemAction } from "@/lib/labs/weather-system/actions";
import {
  applyWeatherSystemAction,
  isWeatherSystemState,
} from "@/lib/labs/weather-system/runtime";
import { isTectonicPlatesAction } from "@/lib/labs/tectonic-plates/actions";
import {
  applyTectonicPlatesAction,
  isTectonicPlatesState,
} from "@/lib/labs/tectonic-plates/runtime";
import type { LabAction, LabId } from "@/lib/labs/types";

export function applyLabAction<S>(labId: LabId, state: S, action: LabAction): S {
  if (labId === "gravity-explorer" && isGravityLabState(state) && isGravityLabAction(action)) {
    return applyGravityLabAction(state, action) as S;
  }

  if (labId === "pendulum-lab" && isPendulumLabState(state) && isPendulumLabAction(action)) {
    return applyPendulumLabAction(state, action) as S;
  }

  if (labId === "molecule-motion" && isMoleculeMotionState(state) && isMoleculeMotionAction(action)) {
    return applyMoleculeMotionAction(state, action) as S;
  }

  if (labId === "human-heart" && isHumanHeartState(state) && isHumanHeartAction(action)) {
    return applyHumanHeartAction(state, action) as S;
  }

  if (labId === "electric-circuit" && isElectricCircuitState(state) && isElectricCircuitAction(action)) {
    return applyElectricCircuitAction(state, action) as S;
  }

  if (labId === "wave-motion" && isWaveMotionState(state) && isWaveMotionAction(action)) {
    return applyWaveMotionAction(state, action) as S;
  }

  if (labId === "cell-division" && isCellDivisionState(state) && isCellDivisionAction(action)) {
    return applyCellDivisionAction(state, action) as S;
  }

  if (labId === "ecosystem-balance" && isEcosystemBalanceState(state) && isEcosystemBalanceAction(action)) {
    return applyEcosystemBalanceAction(state, action) as S;
  }

  if (labId === "chemical-reaction" && isChemicalReactionState(state) && isChemicalReactionAction(action)) {
    return applyChemicalReactionAction(state, action) as S;
  }

  if (labId === "periodic-table" && isPeriodicTableState(state) && isPeriodicTableAction(action)) {
    return applyPeriodicTableAction(state, action) as S;
  }

  if (labId === "weather-system" && isWeatherSystemState(state) && isWeatherSystemAction(action)) {
    return applyWeatherSystemAction(state, action) as S;
  }

  if (labId === "tectonic-plates" && isTectonicPlatesState(state) && isTectonicPlatesAction(action)) {
    return applyTectonicPlatesAction(state, action) as S;
  }

  const definition = getLabDefinition(labId);
  return definition.applyAction(state, action) as S;
}
