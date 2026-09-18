import { describe, expect, it } from "vitest";
import {
  GRADE4_MATH_ONTOLOGY_RELEASE,
  EvidenceAdmissionLedger,
  admitEvidence,
  createDiagnosticResult,
  deterministicReleaseIdentity,
  validateOntologyRelease,
  type CurriculumOntologyRelease,
  type RawLearningObservation,
} from "@/lib/learning-authority/governedGrade4Math";
import { mayReleaseStudentAnswer } from "@/lib/learning-authority/answerRelease";

const context = {
  expectedSchoolId: "school-a",
  expectedStudentId: "student-a",
  expectedStudentUserId: "user-a",
  serverScored: true,
};

const observation = (overrides: Partial<RawLearningObservation> = {}): RawLearningObservation => ({
  idempotencyKey: "obs-0001",
  schoolId: "school-a",
  authenticatedUserId: "user-a",
  studentId: "student-a",
  studentUserId: "user-a",
  itemId: "g4-frac-diagnostic-equal-parts",
  itemVersion: "1.0.0",
  context: "DIAGNOSTIC",
  toolsUsed: [],
  hintsUsed: 0,
  aiAssisted: false,
  source: "ONLINE",
  ...overrides,
});

describe("governed Grade 4 mathematics authority", () => {
  it("executes only an approved published release", () => {
    expect(() => validateOntologyRelease(GRADE4_MATH_ONTOLOGY_RELEASE)).not.toThrow();
    expect(admitEvidence(observation(), context).decision).toBe("ACCEPTED");
    const unpublished = { ...GRADE4_MATH_ONTOLOGY_RELEASE, status: "DRAFT" } as unknown as CurriculumOntologyRelease;
    expect(admitEvidence(observation(), context, unpublished)).toMatchObject({ decision: "REJECTED", reason: "ontology_release_not_executable" });
    const inReview = { ...GRADE4_MATH_ONTOLOGY_RELEASE, status: "IN_REVIEW", reviewStatus: "PENDING" } as CurriculumOntologyRelease;
    expect(admitEvidence(observation(), context, inReview)).toMatchObject({ decision: "REJECTED", reason: "ontology_release_not_executable" });
  });

  it("rejects prerequisite cycles and keeps release identity deterministic", () => {
    const cyclic = {
      ...GRADE4_MATH_ONTOLOGY_RELEASE,
      prerequisites: [
        ...GRADE4_MATH_ONTOLOGY_RELEASE.prerequisites,
        { fromConceptId: "g4-fractions-compare", toConceptId: "g4-fractions-equal-parts", rationale: "hostile cycle" },
      ],
    } as CurriculumOntologyRelease;
    expect(() => validateOntologyRelease(cyclic)).toThrow("ontology_prerequisite_cycle");
    expect(deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE)).toBe(deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE));
    expect(Object.isFrozen(GRADE4_MATH_ONTOLOGY_RELEASE)).toBe(true);
    expect(Object.isFrozen(GRADE4_MATH_ONTOLOGY_RELEASE.concepts[0])).toBe(true);
    const changedPolicy = {
      ...GRADE4_MATH_ONTOLOGY_RELEASE,
      toolPolicies: GRADE4_MATH_ONTOLOGY_RELEASE.toolPolicies.map((policy) =>
        policy.id === "g4-math-diagnostic-tools" ? { ...policy, prohibited: [] } : policy
      ),
    } as CurriculumOntologyRelease;
    expect(deterministicReleaseIdentity(changedPolicy)).not.toBe(deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE));
    const changedItem = {
      ...GRADE4_MATH_ONTOLOGY_RELEASE,
      items: GRADE4_MATH_ONTOLOGY_RELEASE.items.map((item) =>
        item.id === "g4-frac-diagnostic-equal-parts"
          ? { ...item, correctIndex: 0 }
          : item
      ),
    } as CurriculumOntologyRelease;
    expect(deterministicReleaseIdentity(changedItem)).not.toBe(deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE));
  });

  it("pins construct binding and item version", () => {
    const result = admitEvidence(observation(), context);
    expect(result).toMatchObject({ bindingId: "g4-frac-bind-equal-parts-v1", policyVersion: "1.0.0" });
    expect(admitEvidence(observation({ itemVersion: "9.9.9" }), context).reason).toBe("item_version_invalid");
    expect(admitEvidence(observation({ itemId: "unbound-item" }), context).reason).toBe("construct_binding_missing");
  });

  it("requires server scoring and rejects client mastery claims", () => {
    expect(admitEvidence(observation(), { ...context, serverScored: false }).reason).toBe("server_scoring_required");
    expect(admitEvidence(observation({ clientClaimedMastery: true }), context).reason).toBe("client_cannot_assert_mastery");
  });

  it("fails closed for tenant and Student/User identity confusion", () => {
    expect(admitEvidence(observation({ schoolId: "school-b" }), context).reason).toBe("tenant_or_student_identity_mismatch");
    expect(admitEvidence(observation({ studentId: "user-a" }), context).reason).toBe("tenant_or_student_identity_mismatch");
    expect(admitEvidence(observation({ authenticatedUserId: "user-b" }), context).reason).toBe("tenant_or_student_identity_mismatch");
  });

  it("enforces calculator prohibition and authorized accommodation", () => {
    const used = observation({ toolsUsed: ["calculator"] });
    expect(admitEvidence(used, context).reason).toBe("prohibited_tool_used");
    expect(admitEvidence(used, { ...context, accommodationOverride: { approvedByRole: "STUDENT" as never, tool: "calculator" } }).reason).toBe("prohibited_tool_used");
    expect(admitEvidence(used, { ...context, accommodationOverride: { approvedByRole: "TEACHER", tool: "calculator" } }).decision).toBe("ACCEPTED");
  });

  it("labels assistance provisional and teacher observation as human evidence", () => {
    expect(admitEvidence(observation({ hintsUsed: 1 }), context).decision).toBe("PROVISIONAL");
    const teacherRelease = {
      ...GRADE4_MATH_ONTOLOGY_RELEASE,
      items: [...GRADE4_MATH_ONTOLOGY_RELEASE.items, {
        id: "g4-frac-teacher-observation",
        version: "1.0.0",
        context: "TEACHER_OBSERVATION" as never,
        prompt: "Teacher observation",
        options: [],
        correctIndex: 0,
      }],
      bindings: [...GRADE4_MATH_ONTOLOGY_RELEASE.bindings, {
        ...GRADE4_MATH_ONTOLOGY_RELEASE.bindings[0],
        id: "g4-frac-bind-teacher-v1",
        itemId: "g4-frac-teacher-observation",
        evidencePolicyId: "g4-math-teacher-observation",
      }],
    };
    const teacher = observation({ itemId: "g4-frac-teacher-observation", context: "TEACHER_OBSERVATION", source: "TEACHER" });
    expect(admitEvidence(teacher, { ...context, serverScored: false, humanActorRole: "TEACHER" }, teacherRelease)).toMatchObject({ decision: "ACCEPTED" });
    expect(admitEvidence(teacher, { ...context, serverScored: false }, teacherRelease).reason).toBe("human_authority_required");
  });

  it("is idempotent for duplicate observations and never permits legacy projection", () => {
    const ledger = new EvidenceAdmissionLedger();
    expect(ledger.admit(observation(), context).decision).toBe("ACCEPTED");
    expect(ledger.admit(observation(), context)).toMatchObject({ decision: "ACCEPTED", reason: "duplicate_observation_idempotent", legacyMasteryProjectionAllowed: false });
    expect(ledger.size).toBe(1);
    expect(ledger.admit(observation({ idempotencyKey: "obs-0002", clientClaimedMastery: 1 }), context).decision).toBe("REJECTED");
  });

  it("creates diagnostic results that cannot change administrative grade", () => {
    expect(createDiagnosticResult({
      kind: "INITIAL",
      idempotencyKey: "diag-1",
      schoolId: "school-1",
      studentId: "student-1",
      studentUserId: "user-1",
      conceptObservations: [{ conceptId: "g4-fractions-equal-parts", observedPerformance: 1, confidence: 0.4 }],
      recommendedPrerequisiteConceptIds: ["g4-fractions-equal-parts"],
    })).toMatchObject({
      sessionAuthority: "INSTRUCTIONAL_DIAGNOSTIC",
      ontologyReleaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
      mayChangeAdministrativeGrade: false,
    });
    expect(() => createDiagnosticResult({
      kind: "CONTINUOUS",
      idempotencyKey: "diag-2",
      schoolId: "school-1",
      studentId: "student-1",
      studentUserId: "user-1",
      conceptObservations: [{ conceptId: "g4-fractions-equal-parts", observedPerformance: 0, confidence: 1.1 }],
      recommendedPrerequisiteConceptIds: [],
    })).toThrow("diagnostic_confidence_invalid");
  });
});

describe("server-governed student answer release", () => {
  const base = { role: "STUDENT", authenticatedSchoolId: "school-a", activitySchoolId: "school-a", enrolled: true, completedAt: null };
  it("denies unreleased, wrong-tenant, and unauthorized answers", () => {
    expect(mayReleaseStudentAnswer({ ...base, policy: { mode: "NEVER" } })).toBe(false);
    expect(mayReleaseStudentAnswer({ ...base, authenticatedSchoolId: "school-b", policy: { mode: "AFTER_COMPLETION" }, completedAt: new Date() })).toBe(false);
    expect(mayReleaseStudentAnswer({ ...base, role: "TEACHER", policy: { mode: "AFTER_COMPLETION" }, completedAt: new Date() })).toBe(false);
  });

  it("releases only after the governed activity policy", () => {
    expect(mayReleaseStudentAnswer({ ...base, policy: { mode: "AFTER_COMPLETION" } })).toBe(false);
    expect(mayReleaseStudentAnswer({ ...base, policy: { mode: "AFTER_COMPLETION" }, completedAt: new Date() })).toBe(true);
    expect(mayReleaseStudentAnswer({ ...base, policy: { mode: "AFTER_TIME", releaseAt: "2030-01-01T00:00:00.000Z" }, now: new Date("2029-01-01T00:00:00.000Z") })).toBe(false);
    expect(mayReleaseStudentAnswer({ ...base, policy: { mode: "AFTER_TIME", releaseAt: "2030-01-01T00:00:00.000Z" }, now: new Date("2030-01-01T00:00:00.000Z") })).toBe(true);
  });
});
