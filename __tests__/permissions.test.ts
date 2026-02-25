/**
 * __tests__/permissions.test.ts
 *
 * Tests for lib/permissions.ts — ROLE_PERMISSIONS map,
 * hasPermission(), and assertPermission().
 *
 * Verifies:
 *  - ADMIN holds all school-level governance permissions
 *  - TEACHER/STUDENT/GUARDIAN hold NO governance permissions
 *  - Platform admin bypasses all role checks
 *  - National + PII permissions are platform-admin-only
 *  - assertPermission throws 403 for unauthorized roles
 */
import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  assertPermission,
  type Permission,
} from "@/lib/permissions";

// ── Helper ────────────────────────────────────────────────────────────────────
function user(role: string, isPlatformAdmin = false) {
  return { role, isPlatformAdmin };
}

// ── PERMISSIONS object ────────────────────────────────────────────────────────
describe("PERMISSIONS constants", () => {
  it("has unique permission string values", () => {
    const values = Object.values(PERMISSIONS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("uses colon-namespaced format", () => {
    for (const v of Object.values(PERMISSIONS)) {
      expect(v).toMatch(/^[a-z_]+:[a-z_]+:[a-z_]+$/);
    }
  });
});

// ── ROLE_PERMISSIONS map ──────────────────────────────────────────────────────
describe("ROLE_PERMISSIONS map", () => {
  it("ADMIN has COMPLIANCE_AUDIT_READ", () => {
    expect(ROLE_PERMISSIONS.ADMIN.has(PERMISSIONS.COMPLIANCE_AUDIT_READ)).toBe(true);
  });

  it("ADMIN has COMPLIANCE_AUDIT_EXPORT", () => {
    expect(ROLE_PERMISSIONS.ADMIN.has(PERMISSIONS.COMPLIANCE_AUDIT_EXPORT)).toBe(true);
  });

  it("ADMIN has GOVERNANCE_EXPORT_SCHOOL", () => {
    expect(ROLE_PERMISSIONS.ADMIN.has(PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL)).toBe(true);
  });

  it("ADMIN does NOT have GOVERNANCE_EXPORT_NATIONAL", () => {
    expect(ROLE_PERMISSIONS.ADMIN.has(PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL)).toBe(false);
  });

  it("ADMIN does NOT have GOVERNANCE_EXPORT_PII", () => {
    expect(ROLE_PERMISSIONS.ADMIN.has(PERMISSIONS.GOVERNANCE_EXPORT_PII)).toBe(false);
  });

  it("TEACHER has zero governance permissions", () => {
    const govPerms: Permission[] = [
      PERMISSIONS.COMPLIANCE_AUDIT_READ,
      PERMISSIONS.COMPLIANCE_AUDIT_EXPORT,
      PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL,
      PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL,
      PERMISSIONS.GOVERNANCE_EXPORT_PII,
    ];
    for (const p of govPerms) {
      expect(ROLE_PERMISSIONS.TEACHER.has(p)).toBe(false);
    }
  });

  it("STUDENT has zero governance permissions", () => {
    expect(ROLE_PERMISSIONS.STUDENT.size).toBe(0);
  });

  it("GUARDIAN has zero governance permissions", () => {
    expect(ROLE_PERMISSIONS.GUARDIAN.size).toBe(0);
  });

  it("all four roles are defined in ROLE_PERMISSIONS", () => {
    expect(ROLE_PERMISSIONS).toHaveProperty("ADMIN");
    expect(ROLE_PERMISSIONS).toHaveProperty("TEACHER");
    expect(ROLE_PERMISSIONS).toHaveProperty("STUDENT");
    expect(ROLE_PERMISSIONS).toHaveProperty("GUARDIAN");
  });
});

// ── hasPermission ─────────────────────────────────────────────────────────────
describe("hasPermission", () => {
  it("returns true for ADMIN + COMPLIANCE_AUDIT_READ", () => {
    expect(hasPermission(user("ADMIN"), PERMISSIONS.COMPLIANCE_AUDIT_READ)).toBe(true);
  });

  it("returns true for ADMIN + GOVERNANCE_EXPORT_SCHOOL", () => {
    expect(hasPermission(user("ADMIN"), PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL)).toBe(true);
  });

  it("returns false for ADMIN + GOVERNANCE_EXPORT_NATIONAL", () => {
    expect(hasPermission(user("ADMIN"), PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL)).toBe(false);
  });

  it("returns false for ADMIN + GOVERNANCE_EXPORT_PII", () => {
    expect(hasPermission(user("ADMIN"), PERMISSIONS.GOVERNANCE_EXPORT_PII)).toBe(false);
  });

  it("returns false for TEACHER + COMPLIANCE_AUDIT_READ", () => {
    expect(hasPermission(user("TEACHER"), PERMISSIONS.COMPLIANCE_AUDIT_READ)).toBe(false);
  });

  it("returns false for STUDENT + GOVERNANCE_EXPORT_SCHOOL", () => {
    expect(hasPermission(user("STUDENT"), PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL)).toBe(false);
  });

  it("returns false for GUARDIAN + any governance permission", () => {
    expect(hasPermission(user("GUARDIAN"), PERMISSIONS.COMPLIANCE_AUDIT_READ)).toBe(false);
    expect(hasPermission(user("GUARDIAN"), PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL)).toBe(false);
  });

  it("returns false for unknown role", () => {
    expect(hasPermission(user("SUPERVILLAIN"), PERMISSIONS.COMPLIANCE_AUDIT_READ)).toBe(false);
  });
});

// ── Platform Admin bypass ─────────────────────────────────────────────────────
describe("hasPermission — platform admin bypass", () => {
  it("platform admin has GOVERNANCE_EXPORT_NATIONAL even without ADMIN role", () => {
    expect(
      hasPermission(user("ADMIN", true), PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL)
    ).toBe(true);
  });

  it("platform admin has GOVERNANCE_EXPORT_PII", () => {
    expect(
      hasPermission(user("ADMIN", true), PERMISSIONS.GOVERNANCE_EXPORT_PII)
    ).toBe(true);
  });

  it("platform admin with TEACHER role still has all permissions", () => {
    // A TEACHER who is isPlatformAdmin gets all permissions
    expect(
      hasPermission(user("TEACHER", true), PERMISSIONS.COMPLIANCE_AUDIT_READ)
    ).toBe(true);
    expect(
      hasPermission(user("TEACHER", true), PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL)
    ).toBe(true);
  });

  it("isPlatformAdmin=false does not bypass", () => {
    expect(
      hasPermission(user("TEACHER", false), PERMISSIONS.COMPLIANCE_AUDIT_READ)
    ).toBe(false);
  });
});

// ── assertPermission ──────────────────────────────────────────────────────────
describe("assertPermission", () => {
  it("does not throw for ADMIN + COMPLIANCE_AUDIT_READ", () => {
    expect(() =>
      assertPermission(user("ADMIN"), PERMISSIONS.COMPLIANCE_AUDIT_READ)
    ).not.toThrow();
  });

  it("throws 403 for TEACHER + COMPLIANCE_AUDIT_READ", () => {
    try {
      assertPermission(user("TEACHER"), PERMISSIONS.COMPLIANCE_AUDIT_READ);
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toBe("Forbidden");
    }
  });

  it("throws 403 for ADMIN + GOVERNANCE_EXPORT_NATIONAL (school admin only)", () => {
    try {
      assertPermission(user("ADMIN"), PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL);
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.status).toBe(403);
    }
  });

  it("throws 403 for STUDENT + any governance permission", () => {
    expect(() =>
      assertPermission(user("STUDENT"), PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL)
    ).toThrow();
  });

  it("does not throw for platform admin + GOVERNANCE_EXPORT_NATIONAL", () => {
    expect(() =>
      assertPermission(user("ADMIN", true), PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL)
    ).not.toThrow();
  });

  it("does not throw for platform admin + GOVERNANCE_EXPORT_PII", () => {
    expect(() =>
      assertPermission(user("ADMIN", true), PERMISSIONS.GOVERNANCE_EXPORT_PII)
    ).not.toThrow();
  });

  it("thrown error has status 403 (compatible with API route error handler)", () => {
    let caught: any;
    try {
      assertPermission(user("GUARDIAN"), PERMISSIONS.COMPLIANCE_AUDIT_READ);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.status).toBe(403);
    expect(caught instanceof Error).toBe(true);
  });
});

// ── Forbidden-path matrix: all non-admin roles denied all governance perms ────
describe("Forbidden path matrix — non-admin roles denied all governance permissions", () => {
  const forbiddenRoles = ["TEACHER", "STUDENT", "GUARDIAN"];
  const govPermissions: Permission[] = [
    PERMISSIONS.COMPLIANCE_AUDIT_READ,
    PERMISSIONS.COMPLIANCE_AUDIT_EXPORT,
    PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL,
    PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL,
    PERMISSIONS.GOVERNANCE_EXPORT_PII,
  ];

  for (const role of forbiddenRoles) {
    for (const perm of govPermissions) {
      it(`${role} is denied ${perm}`, () => {
        expect(hasPermission(user(role), perm)).toBe(false);
      });
    }
  }
});
