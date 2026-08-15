export const RIGHTS_STATUSES = [
  "PUBLIC_DOMAIN",
  "OPEN_LICENSE",
  "PERMISSION_GRANTED",
  "LICENSED",
  "REFERENCE_ONLY",
  "RIGHTS_UNKNOWN",
  "PROHIBITED",
  "EXPIRED",
  "REVOKED",
] as const;

export const PERMITTED_ACTIONS = [
  "CITATION",
  "METADATA",
  "INTERNAL_ANALYSIS",
  "AI_ANALYSIS",
  "STORAGE",
  "LEARNER_DISPLAY",
  "REPRODUCTION",
  "OFFLINE_DISTRIBUTION",
  "TRANSFORMATION",
] as const;

export type RightsStatus = (typeof RIGHTS_STATUSES)[number];
export type PermittedAction = (typeof PERMITTED_ACTIONS)[number];

const REFERENCE_ONLY_ACTIONS = new Set<PermittedAction>([
  "CITATION",
  "METADATA",
  "INTERNAL_ANALYSIS",
  "AI_ANALYSIS",
]);

export type RightsDecision = {
  allowed: boolean;
  reason:
    | "EXPLICITLY_PERMITTED"
    | "REFERENCE_ONLY_LIMIT"
    | "ACTION_NOT_GRANTED"
    | "RIGHTS_BLOCKED";
};

export function evaluateRights(input: {
  rightsStatus: RightsStatus;
  permittedActions?: readonly PermittedAction[];
  action: PermittedAction;
}): RightsDecision {
  if (["PROHIBITED", "EXPIRED", "REVOKED"].includes(input.rightsStatus)) {
    return { allowed: false, reason: "RIGHTS_BLOCKED" };
  }

  const explicitlyPermitted = new Set(input.permittedActions ?? []).has(input.action);
  if (!explicitlyPermitted) {
    return { allowed: false, reason: "ACTION_NOT_GRANTED" };
  }

  if (input.rightsStatus === "REFERENCE_ONLY" && !REFERENCE_ONLY_ACTIONS.has(input.action)) {
    return { allowed: false, reason: "REFERENCE_ONLY_LIMIT" };
  }

  return { allowed: true, reason: "EXPLICITLY_PERMITTED" };
}

export function assertRightsAllowed(input: Parameters<typeof evaluateRights>[0]): void {
  const decision = evaluateRights(input);
  if (!decision.allowed) {
    throw new Error(`SOURCE_RIGHTS_DENIED:${decision.reason}:${input.action}`);
  }
}
