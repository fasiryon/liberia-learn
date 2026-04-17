import { getLabDefinition } from "@/lib/labs/registry";
import { isGravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import { validateGravityLabAction } from "@/lib/labs/gravity-explorer/validator";
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

  const definition = getLabDefinition(labId);
  return definition.validateAction(state, action);
}
