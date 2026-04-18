import { getLabDefinition } from "@/lib/labs/registry";
import { isGravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import { applyGravityLabAction } from "@/lib/labs/gravity-explorer/runtime";
import { isGravityLabState } from "@/lib/labs/gravity-explorer/runtime";
import { isHumanHeartAction } from "@/lib/labs/human-heart/actions";
import { applyHumanHeartAction, isHumanHeartState } from "@/lib/labs/human-heart/runtime";
import { isMoleculeMotionAction } from "@/lib/labs/molecule-motion/actions";
import {
  applyMoleculeMotionAction,
  isMoleculeMotionState,
} from "@/lib/labs/molecule-motion/runtime";
import { isPendulumLabAction } from "@/lib/labs/pendulum-lab/actions";
import { applyPendulumLabAction, isPendulumLabState } from "@/lib/labs/pendulum-lab/runtime";
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

  const definition = getLabDefinition(labId);
  return definition.applyAction(state, action) as S;
}
