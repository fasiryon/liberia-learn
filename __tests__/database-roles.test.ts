import { describe, expect, it } from "vitest";
import {
  assertDeployedDatabaseRole,
  DEPLOYED_DATABASE_ROLES,
  isDeployedDatabaseRole,
} from "@/lib/auth/databaseRoles";

describe("deployed database role boundary", () => {
  it("matches the currently deployed PostgreSQL Role enum", () => {
    expect(DEPLOYED_DATABASE_ROLES).toEqual([
      "TEACHER",
      "STUDENT",
      "GUARDIAN",
      "ADMIN",
      "DISTRICT_ADMIN",
      "MOE_OFFICIAL",
    ]);
  });

  it.each(["MOE_SUPER_ADMIN", "MOE_DISTRICT_ADMIN"])(
    "blocks undeployed role %s from persistence",
    (role) => {
      expect(isDeployedDatabaseRole(role)).toBe(false);
      expect(() => assertDeployedDatabaseRole(role)).toThrow(
        "Role is not approved for database persistence",
      );
    },
  );
});
