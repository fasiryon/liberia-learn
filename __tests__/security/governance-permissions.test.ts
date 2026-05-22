import { describe, it, expect } from "vitest";
import { assertPermission, hasPermission, PERMISSIONS } from "@/lib/permissions";

const adminUser = { id: "u1", role: "ADMIN", schoolId: "s1", isPlatformAdmin: false };
const platformAdmin = { id: "u2", role: "ADMIN", schoolId: null, isPlatformAdmin: true };
const teacherUser = { id: "u3", role: "TEACHER", schoolId: "s1", isPlatformAdmin: false };
const moeUser = { id: "u4", role: "MOE_OFFICIAL", isPlatformAdmin: false };
const guardianUser = { id: "u5", role: "GUARDIAN", isPlatformAdmin: false };

describe("NR-8 governance permissions matrix", () => {
  // curriculum:approve
  it("1. curriculum:approve — ADMIN passes", () => {
    expect(() => assertPermission(adminUser, PERMISSIONS.CURRICULUM_APPROVE)).not.toThrow();
  });

  it("2. curriculum:approve — TEACHER throws 403", () => {
    expect(() => assertPermission(teacherUser, PERMISSIONS.CURRICULUM_APPROVE)).toThrow();
    try {
      assertPermission(teacherUser, PERMISSIONS.CURRICULUM_APPROVE);
    } catch (err: any) {
      expect(err.status).toBe(403);
    }
  });

  // curriculum:override — isPlatformAdmin only (not in any role set)
  it("3. curriculum:override — isPlatformAdmin passes", () => {
    expect(() => assertPermission(platformAdmin, PERMISSIONS.CURRICULUM_OVERRIDE)).not.toThrow();
  });

  it("4. curriculum:override — ADMIN (non-platform) does not have it via role alone", () => {
    expect(hasPermission(adminUser, PERMISSIONS.CURRICULUM_OVERRIDE)).toBe(false);
  });

  // export:moe
  it("5. governance:export:moe — MOE_OFFICIAL passes", () => {
    expect(() => assertPermission(moeUser, PERMISSIONS.GOVERNANCE_EXPORT_MOE)).not.toThrow();
  });

  it("6. governance:export:moe — TEACHER throws 403", () => {
    expect(() => assertPermission(teacherUser, PERMISSIONS.GOVERNANCE_EXPORT_MOE)).toThrow();
  });

  // export:school-csv
  it("7. governance:export:school — ADMIN passes", () => {
    expect(() => assertPermission(adminUser, PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL)).not.toThrow();
  });

  it("8. governance:export:school — GUARDIAN throws 403", () => {
    expect(() => assertPermission(guardianUser, PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL)).toThrow();
    try {
      assertPermission(guardianUser, PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL);
    } catch (err: any) {
      expect(err.status).toBe(403);
    }
  });

  // audit:read
  it("9. compliance:audit_log:read — MOE_OFFICIAL passes", () => {
    expect(() => assertPermission(moeUser, PERMISSIONS.COMPLIANCE_AUDIT_READ)).not.toThrow();
  });

  it("10. compliance:audit_log:read — TEACHER throws 403", () => {
    expect(() => assertPermission(teacherUser, PERMISSIONS.COMPLIANCE_AUDIT_READ)).toThrow();
  });

  // school:create — isPlatformAdmin only
  it("11. school:create — isPlatformAdmin passes", () => {
    expect(() => assertPermission(platformAdmin, PERMISSIONS.SCHOOL_CREATE)).not.toThrow();
  });

  it("12. school:create — ADMIN without isPlatformAdmin throws 403", () => {
    expect(() => assertPermission(adminUser, PERMISSIONS.SCHOOL_CREATE)).toThrow();
  });

  // cohort:suppress
  it("13. cohort:suppress — MOE_OFFICIAL passes", () => {
    expect(() => assertPermission(moeUser, PERMISSIONS.COHORT_SUPPRESS)).not.toThrow();
  });

  it("14. cohort:suppress — GUARDIAN throws 403", () => {
    expect(() => assertPermission(guardianUser, PERMISSIONS.COHORT_SUPPRESS)).toThrow();
  });

  // user:change_role
  it("15. user:change_role — ADMIN passes", () => {
    expect(() => assertPermission(adminUser, PERMISSIONS.USER_CHANGE_ROLE)).not.toThrow();
  });

  it("16. user:change_role — TEACHER throws 403", () => {
    expect(() => assertPermission(teacherUser, PERMISSIONS.USER_CHANGE_ROLE)).toThrow();
  });

  // isPlatformAdmin bypasses everything
  it("17. isPlatformAdmin bypasses all permission checks", () => {
    for (const perm of Object.values(PERMISSIONS)) {
      expect(hasPermission(platformAdmin, perm)).toBe(true);
    }
  });
});
