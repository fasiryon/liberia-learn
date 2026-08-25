import { describe, expect, it, vi } from "vitest";
import { reviewEligibility } from "@/lib/curriculum/review/eligibility";

const user = { id: "reviewer-user", role: "TEACHER" as const, schoolId: "school-a", isPlatformAdmin: false };
const task = {
  id: "task-1",
  createdByUserId: "task-initiator",
  status: "QUEUED",
  revisionId: "revision-1",
  schoolId: "school-a",
  requiredAuthority: "SCHOOL",
  specialistRequirements: null,
  provenance: {
    currentRevisionId: "revision-1",
    provenanceCompleteness: "VERIFIED",
    curriculumContent: { editedById: "another-user" },
  },
  revision: {
    authorUserId: "another-user",
    sourceRevision: null,
    contentSnapshot: { subject: "MATHEMATICS", grade: 7, contentType: "lesson" },
  },
  assessments: [],
  assignments: [],
};
const credential = {
  id: "credential-1",
  status: "VERIFIED",
  credentialType: "SUBJECT_REVIEW",
  authority: "SCHOOL",
  verifiedAt: new Date("2026-01-01"),
  verifierUserId: "independent-verifier",
  validFrom: new Date("2026-01-01"),
  expiresAt: new Date("2027-01-01"),
  scopes: [{
    id: "scope-1", subject: "MATHEMATICS", gradeMin: 7, gradeMax: 9,
    domains: [], curriculumTypes: ["lesson"], curriculumScopes: ["SCHOOL"], schoolId: "school-a",
  }],
};
const profile = {
  id: "profile-1",
  userId: user.id,
  status: "ACTIVE",
  authority: "SCHOOL",
  schoolId: "school-a",
  available: true,
  maxActiveClaims: 2,
  calibrationEligibleThrough: new Date("2027-01-01"),
  restrictions: [],
  credentials: [credential],
};

function db(overrides: { task?: any; profile?: any; count?: number; sourceConflict?: boolean } = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ conflict: overrides.sourceConflict ?? false }]),
    curriculumReviewTask: { findUnique: vi.fn().mockResolvedValue(overrides.task ?? task) },
    reviewerProfile: { findUnique: vi.fn().mockResolvedValue("profile" in overrides ? overrides.profile : profile) },
    curriculumReviewAssignment: { count: vi.fn().mockResolvedValue(overrides.count ?? 0) },
  } as any;
}

describe("reviewEligibility", () => {
  it("allows a rostered teacher with a matching verified credential", async () => {
    await expect(reviewEligibility({ user, taskId: task.id, slot: "FIRST", now: new Date("2026-08-14") }, db())).resolves.toEqual(expect.objectContaining({ eligible: true, credentialId: "credential-1", credentialScopeId: "scope-1" }));
  });

  it("matches scope against the canonical P2-A V1 identity snapshot", async () => {
    const canonical = { ...task, revision: { ...task.revision, contentSnapshot: { identity: { subject: "MATHEMATICS", grade: 7, contentType: "lesson" } } } };
    await expect(reviewEligibility({ user, taskId: task.id, slot: "FIRST", now: new Date("2026-08-14") }, db({ task: canonical }))).resolves.toEqual(expect.objectContaining({ eligible: true, credentialId: "credential-1" }));
  });

  it("rejects self review and prior independent reviewers", async () => {
    const authored = { ...task, revision: { ...task.revision, authorUserId: user.id } };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ task: authored }))).reasons).toContain("AUTHOR_CONFLICT");
    const prior = { ...task, assessments: [{ reviewerProfile: { userId: user.id } }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "SECOND" }, db({ task: prior }))).reasons).toContain("PRIOR_REVIEWER_CONFLICT");
  });

  it("rejects authorship anywhere in the transitive source-revision chain", async () => {
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ sourceConflict: true }))).reasons)
      .toContain("SOURCE_CHAIN_CONFLICT");
  });

  it("rejects the task initiator even when role, profile, credential, and scope otherwise match", async () => {
    const initiated = { ...task, createdByUserId: user.id };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ task: initiated }))).reasons).toContain("INITIATOR_CONFLICT");
  });

  it("prevents a recused reviewer from reclaiming the same task", async () => {
    const recused = { ...task, assignments: [{ reviewerProfile: { userId: user.id } }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ task: recused }))).reasons)
      .toContain("PRIOR_RECUSAL_CONFLICT");
  });

  it.each([
    ["role but no reviewer profile", null, "PROFILE_MISSING"],
    ["inactive reviewer profile", { ...profile, status: "SUSPENDED" }, "PROFILE_INACTIVE"],
    ["active profile with no credential", { ...profile, credentials: [] }, "CREDENTIAL_MISSING"],
    ["unverified credential", { ...profile, credentials: [{ ...credential, status: "PENDING_VERIFICATION", verifiedAt: null, verifierUserId: null }] }, "CREDENTIAL_UNVERIFIED"],
  ])("fails closed for %s", async (_label, changedProfile, reason) => {
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: changedProfile }))).reasons).toContain(reason);
  });

  it("selects the credential and exact scope that jointly satisfy the policy", async () => {
    const wrongScope = { ...credential.scopes[0], id: "scope-wrong", subject: "BIOLOGY" };
    const rightScope = { ...credential.scopes[0], id: "scope-right" };
    const multiple = { ...profile, credentials: [{ ...credential, scopes: [wrongScope, rightScope] }] };
    await expect(reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: multiple }))).resolves.toEqual(
      expect.objectContaining({ eligible: true, credentialId: credential.id, credentialScopeId: "scope-right" }),
    );
  });

  it.each(["SUSPENDED", "REVOKED"])("rejects a %s credential", async (status) => {
    const changed = { ...profile, credentials: [{ ...credential, status }] };
    const result = await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: changed }));
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("CREDENTIAL_INACTIVE");
  });

  it("rejects expired credentials and scope mismatch", async () => {
    const expired = { ...profile, credentials: [{ ...credential, expiresAt: new Date("2026-01-02") }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST", now: new Date("2026-08-14") }, db({ profile: expired }))).reasons).toContain("CREDENTIAL_EXPIRED");
    const mismatch = { ...profile, credentials: [{ ...credential, scopes: [{ ...credential.scopes[0], subject: "BIOLOGY" }] }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: mismatch }))).reasons).toContain("CREDENTIAL_SCOPE_MISMATCH");
  });

  it("rejects a verified credential before its validity window begins", async () => {
    const future = { ...profile, credentials: [{ ...credential, validFrom: new Date("2026-09-01") }] };
    expect((await reviewEligibility({
      user,
      taskId: task.id,
      slot: "FIRST",
      now: new Date("2026-08-14"),
    }, db({ profile: future }))).reasons).toContain("CREDENTIAL_NOT_YET_VALID");
  });

  it("rejects wrong grade, domain, curriculum, profile-authority, and profile-school scope", async () => {
    const wrongGrade = { ...profile, credentials: [{ ...credential, scopes: [{ ...credential.scopes[0], gradeMin: 8, gradeMax: 9 }] }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: wrongGrade }))).reasons).toContain("CREDENTIAL_SCOPE_MISMATCH");
    const wrongDomain = { ...profile, credentials: [{ ...credential, scopes: [{ ...credential.scopes[0], domains: ["SAFETY"] }] }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: wrongDomain }))).reasons).toContain("CREDENTIAL_SCOPE_MISMATCH");
    const wrongCurriculum = { ...profile, credentials: [{ ...credential, scopes: [{ ...credential.scopes[0], curriculumScopes: ["WAEC"] }] }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: wrongCurriculum }))).reasons).toContain("CREDENTIAL_SCOPE_MISMATCH");
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: { ...profile, schoolId: "school-b" } }))).reasons).toContain("SCHOOL_SCOPE");
  });

  it("rejects a profile whose authority is below the task authority", async () => {
    const moeTask = { ...task, requiredAuthority: "MOE", schoolId: null };
    const moeCredential = {
      ...credential,
      authority: "MOE",
      scopes: [{ ...credential.scopes[0], schoolId: null, curriculumScopes: ["NATIONAL"] }],
    };
    const result = await reviewEligibility({
      user: { id: user.id, role: "MOE_OFFICIAL", schoolId: null },
      taskId: task.id,
      slot: "FIRST",
    }, db({ task: moeTask, profile: { ...profile, authority: "SCHOOL", schoolId: null, credentials: [moeCredential] } }));
    expect(result.reasons).toContain("PROFILE_AUTHORITY_MISMATCH");
  });

  it("rejects cross-school and MOE district decision authority", async () => {
    expect((await reviewEligibility({ user: { ...user, schoolId: "school-b" }, taskId: task.id, slot: "FIRST" }, db())).reasons).toContain("RBAC_CEILING");
    expect((await reviewEligibility({ user: { ...user, role: "MOE_DISTRICT_ADMIN", schoolId: null }, taskId: task.id, slot: "FIRST" }, db())).reasons).toContain("RBAC_CEILING");
  });

  it("fails closed for unresolved legacy conflict provenance", async () => {
    const legacy = { ...task, provenance: { ...task.provenance, provenanceCompleteness: "UNVERIFIED" } };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ task: legacy }))).reasons).toContain("LEGACY_CONFLICT_UNRESOLVED");
  });
});
