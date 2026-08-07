import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertRecentPrivilegedStepUp,
  getStepUpCallbackUrl,
  hasRecentPrivilegedStepUp,
  isPrivilegedAccount,
  isSensitivePrivilegedRequest,
} from "@/lib/auth/privilegedIdentity";
import { parseAuth0MfaClaims } from "@/lib/auth/auth0Claims";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";

const originalEnforcement = process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;

function idToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function assuredAdmin(now = Date.now()) {
  return {
    role: "ADMIN",
    isPlatformAdmin: false,
    authProvider: "auth0",
    mfaVerifiedAt: now - 30_000,
    assuranceExpiresAt: now + 60_000,
    securityVersion: 2,
    privilegedSessionId: "session-1",
  };
}

describe("P1-C privileged identity policy", () => {
  beforeEach(() => {
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
    process.env.PRIVILEGED_STEP_UP_MAX_AGE_SECONDS = "600";
  });

  afterEach(() => {
    if (originalEnforcement === undefined) {
      delete process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;
    } else {
      process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = originalEnforcement;
    }
    delete process.env.PRIVILEGED_STEP_UP_MAX_AGE_SECONDS;
  });

  it("recognizes every privileged role and the platform-admin override", () => {
    for (const role of [
      "ADMIN",
      "DISTRICT_ADMIN",
      "MOE_OFFICIAL",
      "MOE_SUPER_ADMIN",
      "MOE_DISTRICT_ADMIN",
    ]) {
      expect(isPrivilegedAccount({ role })).toBe(true);
    }
    expect(isPrivilegedAccount({ role: "TEACHER", isPlatformAdmin: true })).toBe(true);
    expect(isPrivilegedAccount({ role: "TEACHER" })).toBe(false);
  });

  it("accepts only a current Auth0 or break-glass assurance", () => {
    const now = Date.now();
    expect(hasRecentPrivilegedStepUp(assuredAdmin(now), now)).toBe(true);
    expect(
      hasRecentPrivilegedStepUp({
        ...assuredAdmin(now),
        mfaVerifiedAt: now - 601_000,
      }, now)
    ).toBe(false);
    expect(hasRecentPrivilegedStepUp({ ...assuredAdmin(now), authProvider: "credentials" }, now)).toBe(false);
    expect(hasRecentPrivilegedStepUp({ ...assuredAdmin(now), assuranceExpiresAt: now }, now)).toBe(false);
  });

  it("throws HTTP 428 metadata when step-up is missing", () => {
    expect(() =>
      assertRecentPrivilegedStepUp({ role: "ADMIN", authProvider: "auth0" })
    ).toThrowError(expect.objectContaining({
      status: 428,
      code: "PRIVILEGED_STEP_UP_REQUIRED",
      stepUpUrl: "/auth/step-up",
    }));
  });

  it("requires recent MFA for export, curriculum, policy, and role permissions", () => {
    const admin = { role: "ADMIN", isPlatformAdmin: true };
    for (const permission of [
      PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL,
      PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL,
      PERMISSIONS.CURRICULUM_APPROVE,
      PERMISSIONS.CURRICULUM_OVERRIDE,
      PERMISSIONS.POLICY_CONTROL,
      PERMISSIONS.USER_CHANGE_ROLE,
    ]) {
      expect(() => assertPermission(admin, permission)).toThrowError(
        expect.objectContaining({ status: 428 })
      );
      expect(() =>
        assertPermission({ ...assuredAdmin(), isPlatformAdmin: true }, permission)
      ).not.toThrow();
    }
  });

  it("does not add step-up to ordinary read permissions", () => {
    expect(() =>
      assertPermission({ role: "ADMIN" }, PERMISSIONS.COMPLIANCE_AUDIT_READ)
    ).not.toThrow();
  });

  it("identifies all named sensitive route families", () => {
    const sensitive: Array<[string, string]> = [
      ["/api/admin/governance/exports/jobs", "GET"],
      ["/api/admin/interoperability/oneroster/export", "GET"],
      ["/api/moe/export/national", "GET"],
      ["/api/admin/curriculum/approve", "POST"],
      ["/api/admin/content-review/lesson-1", "PATCH"],
      ["/api/moe/curriculum/publish", "POST"],
      ["/api/platform/security/accept", "POST"],
      ["/api/admin/ops/approvals/request-1/approve", "POST"],
      ["/api/moe/policies", "POST"],
    ];
    for (const [path, method] of sensitive) {
      expect(isSensitivePrivilegedRequest(path, method), `${method} ${path}`).toBe(true);
    }
    expect(isSensitivePrivilegedRequest("/api/admin/analytics", "GET")).toBe(false);
    expect(isSensitivePrivilegedRequest("/api/platform/stats", "GET")).toBe(false);
  });

  it("extracts verified-email and MFA assurance claims from an Auth0 ID token", () => {
    const claims = parseAuth0MfaClaims(
      idToken({
        sub: "auth0|admin-1",
        amr: ["pwd", "mfa"],
        auth_time: 1_800_000_000,
        email_verified: true,
      })
    );
    expect(claims).toMatchObject({
      subject: "auth0|admin-1",
      mfa: true,
      emailVerified: true,
    });
    expect(parseAuth0MfaClaims(idToken({ sub: "auth0|admin-1", amr: ["pwd"] }))?.mfa).toBe(false);
    expect(parseAuth0MfaClaims("invalid")).toBeNull();
  });

  it("builds a same-origin encoded step-up callback", () => {
    expect(getStepUpCallbackUrl("/api/moe/export/national", "?format=csv")).toBe(
      "/auth/step-up?callbackUrl=%2Fapi%2Fmoe%2Fexport%2Fnational%3Fformat%3Dcsv"
    );
  });
});
