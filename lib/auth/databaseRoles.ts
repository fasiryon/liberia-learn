export const DEPLOYED_DATABASE_ROLES = [
  "TEACHER",
  "STUDENT",
  "GUARDIAN",
  "ADMIN",
  "DISTRICT_ADMIN",
  "MOE_OFFICIAL",
] as const;

export type DeployedDatabaseRole = (typeof DEPLOYED_DATABASE_ROLES)[number];

const DEPLOYED_DATABASE_ROLE_SET = new Set<string>(DEPLOYED_DATABASE_ROLES);

export function isDeployedDatabaseRole(value: unknown): value is DeployedDatabaseRole {
  return typeof value === "string" && DEPLOYED_DATABASE_ROLE_SET.has(value);
}

export function assertDeployedDatabaseRole(value: unknown): DeployedDatabaseRole {
  if (!isDeployedDatabaseRole(value)) {
    throw Object.assign(
      new Error("Role is not approved for database persistence"),
      { status: 400, code: "UNDEPLOYED_DATABASE_ROLE" },
    );
  }
  return value;
}
