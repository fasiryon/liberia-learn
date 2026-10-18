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
  tutorAccessFor,
  type AssessmentPurpose,
  type DeliveryMode,
} from "@/lib/assessment/v2";
import { buildDefinition, buildForm, buildReleased, CURRICULUM, SCHOOL } from "./fixtures";

const now = "2026-11-01T00:00:00.000Z";

function deliveryFor(purpose: AssessmentPurpose, mode: Exclude<DeliveryMode, "REVIEWER_PREVIEW">) {
  const released = buildReleased();
  const definition = buildDefinition({ purpose });
  const form = buildForm(definition, released.items);
  const delivery = resolveDelivery({ mode, now, requester: { role: "STUDENT", schoolId: SCHOOL }, release: released.release, revocations: [], expectedCurriculum: CURRICULUM });
  return { ...released, definition, form, delivery };
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
      expect(hintAccessFor(env.single, delivery)).toBe(independent ? "BLOCKED" : "ON_REQUEST");

      const online = projectFormForLearner({ form: env.form, definition: env.definition, items: env.itemMap, attemptId: "att-1", delivery: env.delivery });
      const offline = buildOfflineAssessmentPackage({ form: env.form, definition: env.definition, items: env.itemMap, attemptId: "att-1", delivery: env.delivery });
      for (const form of [online, offline.form]) {
        expect(form.independent).toBe(independent);
        expect(form.items.every((item) => item.hintCount === (independent ? 0 : 1))).toBe(true);
      }

      const afterResponse = learnerDisclosure(env.single, env.singleSpec, "AFTER_RESPONSE", { delivery });
      expect(afterResponse.explanation).toBe(independent ? null : env.singleSpec.explanation);
      expect(afterResponse.correctResponse).toBeNull();
      const afterClose = learnerDisclosure(env.single, env.singleSpec, "AFTER_ATTEMPT_CLOSED", { delivery });
      expect(afterClose).toEqual({ explanation: env.singleSpec.explanation, correctResponse: "0.7" });
    });
  }

  it("refuses a caller downgrade of an independent delivery to instructional", () => {
    const env = deliveryFor("SUMMATIVE", "PRACTICE_UNOFFICIAL");
    expect(() => projectFormForLearner({ form: env.form, definition: env.definition, items: env.itemMap, attemptId: "a", delivery: env.delivery, independent: false }))
      .toThrow("assessment_projection_independence_downgrade_forbidden");
  });

  it("allows a caller to tighten practice to independent", () => {
    const env = deliveryFor("FORMATIVE", "PRACTICE_UNOFFICIAL");
    const form = projectFormForLearner({ form: env.form, definition: env.definition, items: env.itemMap, attemptId: "a", delivery: env.delivery, independent: true });
    expect(form.independent).toBe(true);
    expect(form.items.every((item) => item.hintCount === 0)).toBe(true);
  });

  it("binds the purpose to the form's definition by hash; a substituted definition is refused", () => {
    const env = deliveryFor("SUMMATIVE", "PRACTICE_UNOFFICIAL");
    const relabelled = { ...env.definition, purpose: "FORMATIVE" as const };
    expect(() => projectFormForLearner({ form: env.form, definition: relabelled, items: env.itemMap, attemptId: "a", delivery: env.delivery }))
      .toThrow("assessment_projection_definition_mismatch");
    const other = buildDefinition({ purpose: "FORMATIVE", definitionId: "def-other" });
    expect(() => buildOfflineAssessmentPackage({ form: env.form, definition: other, items: env.itemMap, attemptId: "a", delivery: env.delivery }))
      .toThrow("assessment_projection_definition_mismatch");
  });

  it("items with no hints or a NONE hint policy never offer hints, even in practice", () => {
    const env = deliveryFor("FORMATIVE", "PRACTICE_UNOFFICIAL");
    const delivery = { mode: "PRACTICE_UNOFFICIAL" as const, official: false, purpose: "FORMATIVE" as const };
    expect(hintAccessFor({ ...env.single, feedbackPolicy: { ...env.single.feedbackPolicy, hints: "NONE" } }, delivery)).toBe("NONE");
    expect(hintAccessFor({ ...env.single, hints: [] }, delivery)).toBe("NONE");
  });
});
