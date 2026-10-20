import { describe, expect, it } from "vitest";
import {
  authorizeRelease,
  deriveContentStatus,
  defaultReviewPolicy,
  hashItem,
  recordReview,
  resolveDelivery,
  revokeRelease,
  sealItem,
  validateDefinition,
  validateForm,
  validateItem,
  type AssessmentItemV2,
} from "@/lib/assessment/v2";
import {
  AUTHOR, CURRICULUM, LEAD, REVIEWER_A, REVIEWER_B, SCHOOL,
  approve, approveAll, buildDefinition, buildForm, buildItems, buildReleased, definitionSubject, formSubject, itemSubject, specFor,
} from "./fixtures";

const policy = defaultReviewPolicy("FORMATIVE");

function statusOf(item: AssessmentItemV2, spec: ReturnType<typeof buildItems>["singleSpec"], reviews: Parameters<typeof deriveContentStatus>[0]["reviews"]) {
  return deriveContentStatus({ current: itemSubject(item), provenance: item.provenance, validation: validateItem(item, spec), reviews, policy }).status;
}

describe("Assessment V2 contracts and hashing", () => {
  it("hashes deterministically and validates sealed content", () => {
    const a = buildItems();
    const b = buildItems();
    expect(a.single.itemHash).toBe(b.single.itemHash);
    for (const [item, spec] of a.items.map((item, index) => [item, a.specs[index]] as const)) expect(validateItem(item, spec).issues).toEqual([]);
    const definition = buildDefinition();
    expect(validateDefinition(definition).ok).toBe(true);
    const form = buildForm(definition, a.items);
    expect(validateForm(form, definition, new Map(a.items.map((item) => [`${item.itemId}@${item.version}`, item]))).ok).toBe(true);
  });

  it("rejects a mismatched or hand-edited content hash", () => {
    const { single, singleSpec } = buildItems();
    const tampered = { ...single, stimulus: { ...single.stimulus, prompt: "Which is smaller?" } };
    expect(validateItem(tampered, singleSpec).issues.map((issue) => issue.code)).toContain("item_hash_mismatch");
    const definition = buildDefinition();
    expect(validateDefinition({ ...definition, grade: 8 }).issues.map((issue) => issue.code)).toContain("content_hash_mismatch");
  });

  it("changes the item hash when only the protected key changes", () => {
    const { single, singleSpec } = buildItems();
    const { itemHash: _h, scoringSpecHash: _s, ...unsealed } = single;
    const rekeyed = sealItem(unsealed, { ...singleSpec, key: { kind: "SINGLE_SELECT", correctOptionId: "b" } });
    expect(rekeyed.itemHash).not.toBe(single.itemHash);
    expect(validateItem(single, { ...singleSpec, key: { kind: "SINGLE_SELECT", correctOptionId: "b" } }).issues.map((issue) => issue.code)).toContain("scoring_spec_hash_mismatch");
  });

  it("rejects protected fields smuggled into learner-visible stimulus or hints", () => {
    const { single, singleSpec } = buildItems();
    const { itemHash: _h, scoringSpecHash: _s, ...unsealed } = single;
    const smuggled = sealItem({ ...unsealed, stimulus: { ...unsealed.stimulus, options: [{ optionId: "a", text: "0.7", correct: true } as never, unsealed.stimulus.options[1]] } }, singleSpec);
    expect(validateItem(smuggled, singleSpec).issues.map((issue) => issue.code)).toContain("protected_field_in_learner_content");
  });

  it("rejects keys that do not fit the stimulus and key kinds not allowed for the type", () => {
    const { single, singleSpec, worked, rubricSpec } = buildItems();
    const badKey = { ...singleSpec, key: { kind: "SINGLE_SELECT" as const, correctOptionId: "z" } };
    const { itemHash: _h, scoringSpecHash: _s, ...unsealed } = single;
    expect(validateItem(sealItem(unsealed, badKey), badKey).issues.map((issue) => issue.code)).toContain("key_option_unknown");
    const essayWithKey = specFor("i-worked", { kind: "SHORT_CONSTRUCTED", acceptedAnswers: ["no"], autoScore: "EXACT_NORMALIZED" });
    const { itemHash: _wh, scoringSpecHash: _ws, ...workedUnsealed } = worked;
    expect(validateItem(sealItem(workedUnsealed, essayWithKey), essayWithKey).issues.map((issue) => issue.code)).toContain("key_kind_not_allowed_for_type");
    expect(validateItem(worked, rubricSpec).ok).toBe(true);
  });

  it("requires every definition objective to be explicitly national or LiberiaLearn extension", () => {
    const definition = buildDefinition({ objectiveIds: ["obj-compare", "obj-millions"], alignment: { ...CURRICULUM, nationalObjectiveIds: ["obj-compare"], extensionObjectiveIds: [] } });
    expect(validateDefinition(definition).issues.map((issue) => issue.code)).toContain("objective_alignment_missing");
  });
});

describe("Review state machine", () => {
  it("moves CANDIDATE → VALIDATED → IN_REVIEW → APPROVED only through an authorized human on the exact hash", () => {
    const { single, singleSpec } = buildItems();
    expect(deriveContentStatus({ current: itemSubject(single), provenance: single.provenance, validation: { ok: false, issues: [{ code: "x", path: "y" }] }, reviews: [], policy }).status).toBe("CANDIDATE");
    expect(statusOf(single, singleSpec, [])).toBe("VALIDATED");
    const ai = approve(itemSubject(single), { kind: "AI", agentId: "agent:reviewer" });
    expect(statusOf(single, singleSpec, [ai])).toBe("IN_REVIEW");
    expect(statusOf(single, singleSpec, [ai, approve(itemSubject(single))])).toBe("APPROVED");
  });

  it("never lets AI-generated content become approved by AI review", () => {
    const { single, singleSpec } = buildItems();
    const aiReviews = [1, 2, 3].map((n) => approve(itemSubject(single), { kind: "AI", agentId: `agent:${n}` }));
    const state = deriveContentStatus({ current: itemSubject(single), provenance: single.provenance, validation: validateItem(single, singleSpec), reviews: aiReviews, policy });
    expect(state.status).toBe("IN_REVIEW");
    expect(state.reasons).toContain("ai_recommendation_is_not_approval");
    expect(() => recordReview({ review: { ...aiReviews[0], decision: "APPROVE" }, current: itemSubject(single), provenance: single.provenance, schoolId: null })).toThrow("assessment_ai_cannot_decide");
  });

  it("invalidates approval when the item content changes (stale approval)", () => {
    const { single, singleSpec } = buildItems();
    const approval = approve(itemSubject(single));
    const { itemHash: _h, scoringSpecHash: _s, ...unsealed } = single;
    const edited = sealItem({ ...unsealed, stimulus: { ...unsealed.stimulus, prompt: "Which number is greater?" } }, singleSpec);
    const state = deriveContentStatus({ current: itemSubject(edited), provenance: edited.provenance, validation: validateItem(edited, singleSpec), reviews: [approval], policy });
    expect(state.status).toBe("VALIDATED");
    expect(state.staleReviewIds).toEqual([approval.reviewId]);
    expect(() => recordReview({ review: approval, current: itemSubject(edited), provenance: edited.provenance, schoolId: null })).toThrow("assessment_review_hash_mismatch");
  });

  it("blocks author self-approval, non-reviewer roles and approvals with failing checks", () => {
    const { single } = buildItems();
    const current = itemSubject(single);
    const selfApproval = approve(current, { kind: "HUMAN", userId: AUTHOR.id, role: "ASSESSMENT_REVIEWER" });
    expect(() => recordReview({ review: selfApproval, current, provenance: single.provenance, schoolId: null })).toThrow("assessment_author_cannot_approve");
    const teacher = approve(current, { kind: "HUMAN", userId: "t-1", role: "TEACHER" });
    expect(() => recordReview({ review: teacher, current, provenance: single.provenance, schoolId: null })).toThrow("assessment_reviewer_role_required");
    const failing = { ...approve(current), checks: approve(current).checks.map((check) => (check.check === "FAIRNESS" ? { ...check, outcome: "FAIL" as const } : check)) };
    expect(() => recordReview({ review: failing, current, provenance: single.provenance, schoolId: null })).toThrow("assessment_approval_requires_all_checks_pass");
  });

  it("requires two independent approvals for summative and examination purposes", () => {
    const { single, singleSpec } = buildItems();
    const examPolicy = defaultReviewPolicy("EXAMINATION");
    const derive = (reviews: Parameters<typeof deriveContentStatus>[0]["reviews"]) => deriveContentStatus({ current: itemSubject(single), provenance: single.provenance, validation: validateItem(single, singleSpec), reviews, policy: examPolicy }).status;
    expect(derive([approve(itemSubject(single))])).toBe("IN_REVIEW");
    expect(derive([approve(itemSubject(single)), approve(itemSubject(single), REVIEWER_A, "2026-10-02T00:00:00.000Z")])).toBe("IN_REVIEW");
    expect(derive([approve(itemSubject(single)), approve(itemSubject(single), REVIEWER_B)])).toBe("APPROVED");
  });

  it("lets the latest authorized rejection override earlier approval", () => {
    const { single, singleSpec } = buildItems();
    const rejection = { ...approve(itemSubject(single), REVIEWER_B, "2026-10-03T00:00:00.000Z"), reviewId: "rej", decision: "REJECT" as const };
    expect(statusOf(single, singleSpec, [approve(itemSubject(single)), rejection])).toBe("REJECTED");
  });
});

describe("Authorized release and deny-by-default delivery", () => {
  const now = "2026-11-01T00:00:00.000Z";

  it("releases only fully approved exact content, by an authorized non-author", () => {
    const { release } = buildReleased();
    expect(release.items).toHaveLength(5);
    expect(release.curriculum).toEqual(CURRICULUM);
    const built = buildItems();
    const definition = buildDefinition();
    const form = buildForm(definition, built.items);
    const base = { releaseId: "r", definition, form, items: built.items, specs: built.specs, permittedModes: ["OFFICIAL"] as const, effectiveFrom: "2026-10-01T00:00:00.000Z", effectiveUntil: null, schoolId: SCHOOL, authorizedAt: "2026-10-02T00:00:00.000Z" };
    const missingOneItem = approveAll(definition, form, built.items).filter((review) => review.subject.kind !== "ITEM" || review.subject.itemId !== "i-worked");
    expect(() => authorizeRelease({ ...base, reviews: missingOneItem, actor: LEAD })).toThrow(/assessment_release_item_not_approved:.*i-worked/);
    expect(() => authorizeRelease({ ...base, reviews: approveAll(definition, form, built.items), actor: { userId: "rev", role: "ASSESSMENT_REVIEWER" } })).toThrow("assessment_release_role_forbidden");
    expect(() => authorizeRelease({ ...base, reviews: approveAll(definition, form, built.items), actor: { userId: AUTHOR.id, role: "CURRICULUM_LEAD" } })).toThrow("assessment_author_cannot_release");
    expect(() => authorizeRelease({ ...base, schoolId: null, reviews: approveAll(definition, form, built.items), actor: LEAD })).toThrow("assessment_national_release_requires_platform_admin");
  });

  it("refuses a release after any item edit invalidates its approval", () => {
    const built = buildItems();
    const definition = buildDefinition();
    const form = buildForm(definition, built.items);
    const reviews = approveAll(definition, form, built.items);
    const { itemHash: _h, scoringSpecHash: _s, ...unsealed } = built.single;
    const edited = sealItem({ ...unsealed, stimulus: { ...unsealed.stimulus, prompt: "Edited after approval" } }, built.singleSpec);
    const items = [edited, ...built.items.slice(1)];
    const editedForm = buildForm(definition, items);
    expect(() => authorizeRelease({ releaseId: "r", definition, form: editedForm, items, specs: built.specs, reviews, permittedModes: ["OFFICIAL"], effectiveFrom: "2026-10-01T00:00:00.000Z", effectiveUntil: null, schoolId: SCHOOL, actor: LEAD, authorizedAt: "2026-10-02T00:00:00.000Z" })).toThrow("assessment_release_form_not_approved");
    expect(hashItem(edited)).not.toBe(built.single.itemHash);
  });

  it("never delivers candidate (unreleased) content to learners or as certified", () => {
    for (const mode of ["OFFICIAL", "PRACTICE_UNOFFICIAL"] as const) {
      expect(resolveDelivery({ mode, now, requester: { role: "STUDENT", schoolId: SCHOOL }, release: null, revocations: [], expectedCurriculum: null }).allowed).toBe(false);
    }
    expect(resolveDelivery({ mode: "REVIEWER_PREVIEW", now, requester: { role: "TEACHER", schoolId: SCHOOL }, release: null, revocations: [], expectedCurriculum: null }).allowed).toBe(false);
    const preview = resolveDelivery({ mode: "REVIEWER_PREVIEW", now, requester: { role: "ASSESSMENT_REVIEWER", schoolId: null }, release: null, revocations: [], expectedCurriculum: null });
    expect(preview).toMatchObject({ allowed: true, official: false, label: "REVIEWER_PREVIEW_UNRELEASED" });
  });

  it("denies tampered, revoked, expired, wrong-school, wrong-mode and wrong-curriculum delivery", () => {
    const { release } = buildReleased({ permittedModes: ["PRACTICE_UNOFFICIAL"] });
    const request = { mode: "PRACTICE_UNOFFICIAL" as const, now, requester: { role: "STUDENT", schoolId: SCHOOL }, release, revocations: [], expectedCurriculum: CURRICULUM };
    expect(resolveDelivery(request)).toMatchObject({ allowed: true, official: false, label: "PRACTICE_NOT_OFFICIAL" });
    expect(resolveDelivery({ ...request, mode: "OFFICIAL" }).reason).toBe("mode_not_permitted_by_release");
    expect(resolveDelivery({ ...request, release: { ...release, permittedModes: ["OFFICIAL", "PRACTICE_UNOFFICIAL"] }, mode: "OFFICIAL" }).reason).toBe("release_hash_mismatch");
    expect(resolveDelivery({ ...request, requester: { role: "STUDENT", schoolId: "school-2" } }).reason).toBe("release_school_scope_mismatch");
    expect(resolveDelivery({ ...request, now: "2027-08-01T00:00:00.000Z" }).reason).toBe("release_expired");
    expect(resolveDelivery({ ...request, now: "2026-09-01T00:00:00.000Z" }).reason).toBe("release_not_yet_effective");
    expect(resolveDelivery({ ...request, expectedCurriculum: { releaseId: CURRICULUM.releaseId, releaseIdentity: "sha256:updated-curriculum" } }).reason).toBe("release_curriculum_version_mismatch");
    const { revocation } = revokeRelease({ release, actor: LEAD, reason: "Key error found in item 3 after release", revokedAt: now, evidenceDisposition: "INVALIDATE" });
    expect(resolveDelivery({ ...request, revocations: [revocation] }).reason).toBe("release_revoked");
  });

  it("requires authority and a reason to revoke", () => {
    const { release } = buildReleased();
    expect(() => revokeRelease({ release, actor: { userId: "t", role: "TEACHER" }, reason: "Key error found in item 3", revokedAt: now, evidenceDisposition: "INVALIDATE" })).toThrow("assessment_release_role_forbidden");
    expect(() => revokeRelease({ release, actor: LEAD, reason: "oops", revokedAt: now, evidenceDisposition: "INVALIDATE" })).toThrow("assessment_revocation_reason_required");
  });

  it("binds reviews to definitions and forms by exact hash too", () => {
    const definition = buildDefinition();
    const built = buildItems();
    const form = buildForm(definition, built.items);
    expect(definitionSubject(definition).hash).toBe(definition.contentHash);
    expect(formSubject(form).hash).toBe(form.formHash);
  });
});
