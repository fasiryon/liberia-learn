import { getLabDefinition } from "@/lib/labs/registry";
import { isGravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import { applyGravityLabAction } from "@/lib/labs/gravity-explorer/runtime";
import { isGravityLabState } from "@/lib/labs/gravity-explorer/runtime";
import type { LabAction, LabId } from "@/lib/labs/types";

export function applyLabAction<S>(labId: LabId, state: S, action: LabAction): S {
  if (labId === "gravity-explorer" && isGravityLabState(state) && isGravityLabAction(action)) {
    return applyGravityLabAction(state, action) as S;
  }

  const definition = getLabDefinition(labId);
  return definition.applyAction(state, action) as S;
}
