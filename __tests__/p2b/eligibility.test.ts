import { describe, expect, it, vi } from "vitest";
import { reviewEligibility } from "@/lib/curriculum/review/eligibility";

const user = { id: "reviewer-user", role: "TEACHER" as const, schoolId: "school-a", isPlatformAdmin: false };
const task = {
  id: "task-1",
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
    curriculumTypes: ["lesson"], curriculumScopes: ["SCHOOL"], schoolId: "school-a",
  }],
};
const profile = {
  id: "profile-1",
  userId: user.id,
  status: "ACTIVE",
  available: true,
  maxActiveClaims: 2,
  calibrationEligibleThrough: new Date("2027-01-01"),
  restrictions: [],
  credentials: [credential],
};

function db(overrides: { task?: any; profile?: any; count?: number } = {}) {
  return {
    curriculumReviewTask: { findUnique: vi.fn().mockResolvedValue(overrides.task ?? task) },
    reviewerProfile: { findUnique: vi.fn().mockResolvedValue(overrides.profile ?? profile) },
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

  it.each(["SUSPENDED", "REVOKED"])("rejects a %s credential", async (status) => {
    const changed = { ...profile, credentials: [{ ...credential, status }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: changed }))).eligible).toBe(false);
  });

  it("rejects expired credentials and scope mismatch", async () => {
    const expired = { ...profile, credentials: [{ ...credential, expiresAt: new Date("2026-01-02") }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST", now: new Date("2026-08-14") }, db({ profile: expired }))).reasons).toContain("CREDENTIAL_EXPIRED");
    const mismatch = { ...profile, credentials: [{ ...credential, scopes: [{ ...credential.scopes[0], subject: "BIOLOGY" }] }] };
    expect((await reviewEligibility({ user, taskId: task.id, slot: "FIRST" }, db({ profile: mismatch }))).reasons).toContain("CREDENTIAL_SCOPE_MISMATCH");
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
