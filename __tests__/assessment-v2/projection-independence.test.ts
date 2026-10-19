/**
 * F2 regression suite (docs/architecture/learning-loop/INTEGRATION_BOUNDARIES_HANDOFF_V1.md §0, §B.3).
 *
 * Hints, explanations (worked solutions) and answer keys are restricted by the authoritative
 * `isIndependentAssessment(delivery)` classification, which considers purpose as well as officialness.
 */
import { describe, expect, it } from "vitest";
import {
  buildOfflineAssessmentPackage,
  hintAccessFor,
  isIndependentAssessment,
  learnerDisclosure,
  projectFormForLearner,
  resolveDelivery,
  resolveFormIndependence,
  tutorAccessFor,
  type AssessmentPurpose,
  type DeliveryMode,
} from "@/lib/assessment/v2";
import { buildDefinition, buildForm, buildReleased, CURRICULUM, SCHOOL } from "./fixtures";

const now = "2026-11-01T00:00:00.000Z";

/** A real release of a definition with this purpose, delivered in this mode. */
function deliveryFor(purpose: AssessmentPurpose, mode: Exclude<DeliveryMode, "REVIEWER_PREVIEW">) {
  const released = buildReleased({ purpose });
  const delivery = resolveDelivery({ mode, now, requester: { role: "STUDENT", schoolId: SCHOOL }, release: released.release, revocations: [], expectedCurriculum: CURRICULUM });
  const decision = resolveFormIndependence({ form: released.form, definition: released.definition, release: released.release, delivery });
  return { ...released, delivery, decision };
}

const CASES: readonly { purpose: AssessmentPurpose; mode: "OFFICIAL" | "PRACTICE_UNOFFICIAL"; independent: boolean }[] = [
  { purpose: "DIAGNOSTIC", mode: "PRACTICE_UNOFFICIAL", independent: true },
  { purpose: "SUMMATIVE", mode: "PRACTICE_UNOFFICIAL", independent: true },
  { purpose: "RETENTION", mode: "PRACTICE_UNOFFICIAL", independent: true },
  { purpose: "TRANSFER", mode: "PRACTICE_UNOFFICIAL", independent: true },
  { purpose: "FORMATIVE", mode: "OFFICIAL", independent: true },
  { purpose: "DIAGNOSTIC", mode: "OFFICIAL", independent: true },
  { purpose: "SUMMATIVE", mode: "OFFICIAL", independent: true },
  { purpose: "RETENTION", mode: "OFFICIAL", independent: true },
  { purpose: "TRANSFER", mode: "OFFICIAL", independent: true },
  { purpose: "FORMATIVE", mode: "PRACTICE_UNOFFICIAL", independent: false },
];

describe("F2: independence, not officialness, gates hints, worked solutions and keys", () => {
  for (const { purpose, mode, independent } of CASES) {
    it(`${purpose} / ${mode} → ${independent ? "independent: no hints, no tutor, nothing disclosed before close" : "practice: hints and post-response explanation kept"}`, () => {
      const env = deliveryFor(purpose, mode);
      const delivery = { mode, official: env.delivery.official, purpose };
      expect(isIndependentAssessment(delivery)).toBe(independent);
      expect(tutorAccessFor(delivery)).toBe(independent ? "BLOCKED" : "INSTRUCTIONAL");
      expect(hintAccessFor(env.single, env.decision)).toBe(independent ? "BLOCKED" : "ON_REQUEST");

      const online = projectFormForLearner({ form: env.form, definition: env.definition, release: env.release, items: env.itemMap, attemptId: "att-1", delivery: env.delivery });
      const offline = buildOfflineAssessmentPackage({ form: env.form, definition: env.definition, release: env.release, items: env.itemMap, attemptId: "att-1", delivery: env.delivery });
      for (const form of [online, offline.form]) {
        expect(form.independent).toBe(independent);
        expect(form.items.every((item) => item.hintCount === (independent ? 0 : 1))).toBe(true);
      }

      const afterResponse = learnerDisclosure(env.single, env.singleSpec, "AFTER_RESPONSE", { decision: env.decision, attemptStatus: "OPEN" });
      expect(afterResponse.explanation).toBe(independent ? null : env.singleSpec.explanation);
      expect(afterResponse.correctResponse).toBeNull();
      expect(() => learnerDisclosure(env.single, env.singleSpec, "AFTER_ATTEMPT_CLOSED", { decision: env.decision, attemptStatus: "OPEN" })).toThrow("assessment_disclosure_attempt_still_open");
      const afterClose = learnerDisclosure(env.single, env.singleSpec, "AFTER_ATTEMPT_CLOSED", { decision: env.decision, attemptStatus: "SUBMITTED" });
      expect(afterClose).toEqual({ explanation: env.singleSpec.explanation, correctResponse: "0.7" });
    });
  }

  it("refuses a caller downgrade of an independent delivery to instructional", () => {
    const env = deliveryFor("SUMMATIVE", "PRACTICE_UNOFFICIAL");
    expect(() => projectFormForLearner({ form: env.form, definition: env.definition, release: env.release, items: env.itemMap, attemptId: "a", delivery: env.delivery, independent: false }))
      .toThrow("assessment_projection_independence_downgrade_forbidden");
  });

  it("allows a caller to tighten practice to independent", () => {
    const env = deliveryFor("FORMATIVE", "PRACTICE_UNOFFICIAL");
    const form = projectFormForLearner({ form: env.form, definition: env.definition, release: env.release, items: env.itemMap, attemptId: "a", delivery: env.delivery, independent: true });
    expect(form.independent).toBe(true);
    expect(form.items.every((item) => item.hintCount === 0)).toBe(true);
  });

  it("binds the form and definition to the delivered release; a form with another purpose cannot ride a release", () => {
    const summative = deliveryFor("SUMMATIVE", "PRACTICE_UNOFFICIAL");
    // Same items, FORMATIVE purpose, projected under the SUMMATIVE release: refused.
    const formativeDefinition = buildDefinition({ purpose: "FORMATIVE" });
    const formativeForm = buildForm(formativeDefinition, summative.items);
    expect(() => projectFormForLearner({ form: formativeForm, definition: formativeDefinition, release: summative.release, items: summative.itemMap, attemptId: "a", delivery: summative.delivery }))
      .toThrow("assessment_projection_release_mismatch");
    // A delivery decision for another release: refused.
    const other = deliveryFor("FORMATIVE", "PRACTICE_UNOFFICIAL");
    expect(() => projectFormForLearner({ form: summative.form, definition: summative.definition, release: summative.release, items: summative.itemMap, attemptId: "a", delivery: { ...summative.delivery, releaseId: "rel-other" } }))
      .toThrow("assessment_projection_release_mismatch");
    // No release outside reviewer preview: refused.
    expect(() => buildOfflineAssessmentPackage({ form: other.form, definition: other.definition, release: null, items: other.itemMap, attemptId: "a", delivery: other.delivery }))
      .toThrow("assessment_projection_release_required");
  });

  it("tightened independence also governs hints and disclosure, and can never be relaxed", () => {
    const env = deliveryFor("FORMATIVE", "PRACTICE_UNOFFICIAL");
    const tightened = resolveFormIndependence({ form: env.form, definition: env.definition, release: env.release, delivery: env.delivery, independent: true });
    expect(hintAccessFor(env.single, tightened)).toBe("BLOCKED");
    expect(learnerDisclosure(env.single, env.singleSpec, "AFTER_RESPONSE", { decision: tightened, attemptStatus: "OPEN" }).explanation).toBeNull();
    const summative = deliveryFor("SUMMATIVE", "PRACTICE_UNOFFICIAL");
    expect(() => resolveFormIndependence({ form: summative.form, definition: summative.definition, release: summative.release, delivery: summative.delivery, independent: false }))
      .toThrow("assessment_projection_independence_downgrade_forbidden");
  });

  it("hint access and disclosure accept only an issued decision, for an item on its form", () => {
    const env = deliveryFor("SUMMATIVE", "PRACTICE_UNOFFICIAL");
    // A route cannot hand in its own idea of the delivery, or a copied decision that relaxes it.
    const forged = { ...env.decision, independent: false };
    expect(() => hintAccessFor(env.single, forged)).toThrow("assessment_independence_decision_unverified");
    expect(() => learnerDisclosure(env.single, env.singleSpec, "AFTER_RESPONSE", { decision: { mode: "PRACTICE_UNOFFICIAL", official: false, purpose: "FORMATIVE" } as never, attemptStatus: "OPEN" }))
      .toThrow("assessment_independence_decision_unverified");
    expect(() => hintAccessFor({ ...env.single, itemId: "i-elsewhere" }, env.decision)).toThrow("assessment_independence_decision_item_mismatch");
  });

  it("a release object whose content does not match its hash is refused", () => {
    const env = deliveryFor("SUMMATIVE", "PRACTICE_UNOFFICIAL");
    const tampered = { ...env.release, permittedModes: ["PRACTICE_UNOFFICIAL" as const] };
    expect(() => projectFormForLearner({ form: env.form, definition: env.definition, release: tampered, items: env.itemMap, attemptId: "a", delivery: env.delivery }))
      .toThrow("assessment_projection_release_mismatch");
    expect(() => projectFormForLearner({ form: env.form, definition: env.definition, release: env.release, items: env.itemMap, attemptId: "a", delivery: { ...env.delivery, releaseHash: "other" } }))
      .toThrow("assessment_projection_release_mismatch");
  });

  it("binds the purpose to the form's definition by hash; a substituted definition is refused", () => {
    const env = deliveryFor("SUMMATIVE", "PRACTICE_UNOFFICIAL");
    const relabelled = { ...env.definition, purpose: "FORMATIVE" as const };
    expect(() => projectFormForLearner({ form: env.form, definition: relabelled, release: env.release, items: env.itemMap, attemptId: "a", delivery: env.delivery }))
      .toThrow("assessment_projection_definition_mismatch");
    const other = buildDefinition({ purpose: "FORMATIVE", definitionId: "def-other" });
    expect(() => buildOfflineAssessmentPackage({ form: env.form, definition: other, release: env.release, items: env.itemMap, attemptId: "a", delivery: env.delivery }))
      .toThrow("assessment_projection_definition_mismatch");
  });

  it("items with no hints or a NONE hint policy never offer hints, even in practice", () => {
    const env = deliveryFor("FORMATIVE", "PRACTICE_UNOFFICIAL");
    expect(hintAccessFor({ ...env.single, feedbackPolicy: { ...env.single.feedbackPolicy, hints: "NONE" } }, env.decision)).toBe("NONE");
    expect(hintAccessFor({ ...env.single, hints: [] }, env.decision)).toBe("NONE");
  });
});
