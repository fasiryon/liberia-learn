import fs from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity, validateOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import { buildGovernedCellInventory } from "@/lib/learning-authority/governedInventory";
import { GRADE4_MATH_TEMPLATE_CELL } from "@/lib/learning-authority/cells/grade4Math";
import { publishedReleases } from "@/lib/learning-authority/publishedReleases";
import {
  GRADE4_MATH_2026_2_ADDITIONS, GRADE4_MATH_RELEASE_2026_2_ID, composeGrade4MathRelease2026_2, lessonPayloadSha256,
  type ReleaseApproval, type ReviewLedger,
} from "@/lib/learning-authority/releases/grade4Math2026_2";
import { GRADE4_FRACTIONS_LESSON, GRADE4_FRACTIONS_LESSON_2026_2 } from "@/lib/curriculum/authority/grade4FractionsLesson";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";

const PARTS_OF_A_SET = "moe-math-g4-s1-p3-number-theory-and-fraction-obj4";
const ledger = JSON.parse(fs.readFileSync("curriculum/review/g4-math/review-ledger.json", "utf8")) as ReviewLedger;
/** Test-only simulation of a future founder decision. Never written to the repository ledger. */
const simulatedLedger = (decisions: Record<string, "APPROVE">): ReviewLedger => Object.fromEntries(Object.entries(ledger).map(([id, entry]) =>
  [id, decisions[id] ? { decision: decisions[id], reviewer: "simulated-founder", reviewedAt: "2026-10-01T00:00:00.000Z", notes: "" } : entry]));

describe("release 2026.1 stays immutable", () => {
  it("keeps the published identity and the 1.0.0 lesson payload unchanged", () => {
    expect(deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE)).toBe("de256495ec6f72fe8160179331c7f891d0574a2087a21163fbe28b93f9d88540");
    expect(createHash("sha256").update(JSON.stringify(GRADE4_FRACTIONS_LESSON.payload)).digest("hex"))
      .toBe("3138edc3d4f8880fe91724c6857ab1f02b976cb8800b7f89cec466bee337f447");
    expect(GRADE4_MATH_ONTOLOGY_RELEASE.contentBindings.map((binding) => `${binding.contentId}@${binding.contentVersion}`))
      .toEqual(["ll-g4-math-fractions-equal-parts-2026.1@1.0.0"]);
    expect(publishedReleases().map((release) => release.id)).toEqual(["lr-moe-g4-math-fractions-2026.1"]);
  });
});

describe("fractions exemplar 2026.2", () => {
  const lesson = GRADE4_FRACTIONS_LESSON_2026_2;
  const addition = GRADE4_MATH_2026_2_ADDITIONS.find((entry) => entry.moeObjectiveId === PARTS_OF_A_SET)!;

  it("is a new content identity that supersedes 1.0.0 instead of mutating it", () => {
    expect(lesson.contentId).not.toBe(GRADE4_FRACTIONS_LESSON.contentId);
    expect(lesson.supersedes).toEqual({ contentId: GRADE4_FRACTIONS_LESSON.contentId, version: GRADE4_FRACTIONS_LESSON.version });
    expect(lesson.provenance.reviewState).toBe("PENDING_FOUNDER_REVIEW");
    expect(lesson.provenance.authorityScope).toContain("not MOE approval");
  });

  it("is at least as complete as the drafts and teaches parts of a set", () => {
    const draftKeys = Object.keys(GRADE4_MATH_DRAFT_LESSONS[0].payload).sort();
    for (const key of draftKeys) expect(Object.keys(lesson.payload)).toContain(key);
    expect(lesson.payload.practice.length).toBeGreaterThanOrEqual(3);
    expect(lesson.payload.quiz.length).toBeGreaterThanOrEqual(3);
    for (const question of [...lesson.payload.quiz, lesson.payload.diagnosticCheck]) expect(question.options).toContain(question.answer);
    expect(lesson.payload.body).toContain("part of a set");
    expect(lesson.payload.objectives).toContain("Name the fraction of a set of objects.");
  });

  it("binds diagnostic, practice and end-of-lesson evidence to governed items", () => {
    const evidence = lesson.payload.evidence;
    expect(GRADE4_MATH_ONTOLOGY_RELEASE.items.some((item) => item.id === evidence.diagnostic.itemId && item.version === evidence.diagnostic.itemVersion)).toBe(true);
    const added = new Map(addition.items.map((item) => [item.id, item]));
    for (const ref of [...evidence.practice, evidence.endOfLesson]) expect(added.get(ref.itemId)?.version).toBe(ref.itemVersion);
    const exit = added.get(evidence.endOfLesson.itemId)!;
    expect(exit.prompt).toBe(GRADE4_FRACTIONS_LESSON.payload.assessment.question);
    expect(exit.options[exit.correctIndex]).toBe(GRADE4_FRACTIONS_LESSON.payload.assessment.correctAnswer);
    for (const item of addition.items) expect(item.options[item.correctIndex]).toBeDefined();
    expect(addition.bindings.every((binding) => binding.conceptId === "g4-fractions-equal-parts")).toBe(true);
  });
});

describe("release 2026.2 candidate", () => {
  it("is not executable while the founder ledger is PENDING, and includes no drafts", () => {
    const composed = composeGrade4MathRelease2026_2({ ledger });
    expect(composed.executable).toBe(false);
    expect(composed.release).toMatchObject({ id: GRADE4_MATH_RELEASE_2026_2_ID, status: "IN_REVIEW", reviewStatus: "PENDING" });
    expect(() => validateOntologyRelease(composed.release)).toThrow("ontology_release_not_executable");
    expect(() => buildGovernedCellInventory({ ...GRADE4_MATH_TEMPLATE_CELL, releaseId: composed.release.id }, composed.release)).toThrow("ontology_release_not_executable");
    expect(composed.release.items).toEqual(GRADE4_MATH_ONTOLOGY_RELEASE.items);
    const excluded = new Set(composed.excluded.map((entry) => entry.id));
    for (const draft of GRADE4_MATH_DRAFT_LESSONS) expect(excluded.has(draft.contentId)).toBe(true);
    expect(excluded.has(GRADE4_FRACTIONS_LESSON_2026_2.contentId)).toBe(true);
    expect(composed.included.every((entry) => !GRADE4_MATH_DRAFT_LESSONS.some((draft) => draft.contentId === entry.id))).toBe(true);
    expect(composed.carriedForwardFrom).toEqual({ releaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id, identity: deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE) });
  });

  it("is reproducible", () => {
    expect(composeGrade4MathRelease2026_2({ ledger }).approvableIdentity).toBe(composeGrade4MathRelease2026_2({ ledger }).approvableIdentity);
  });

  it("becomes executable only with an APPROVE decision and a release approval naming its exact identity (simulated)", () => {
    const approvedLedger = simulatedLedger({ [PARTS_OF_A_SET]: "APPROVE" });
    const pending = composeGrade4MathRelease2026_2({ ledger: approvedLedger });
    expect(pending.executable).toBe(false);
    const approval: ReleaseApproval = { releaseId: GRADE4_MATH_RELEASE_2026_2_ID, approvedIdentity: pending.approvableIdentity, reviewer: "simulated-founder", reviewedAt: "2026-10-01T00:00:00.000Z" };
    const composed = composeGrade4MathRelease2026_2({ ledger: approvedLedger, approval });
    expect(composed.executable).toBe(true);
    expect(() => validateOntologyRelease(composed.release)).not.toThrow();
    expect(deterministicReleaseIdentity(composed.release)).toBe(pending.approvableIdentity);
    // Carried-forward items are identical; the lesson binding moves to 2026.2 with a payload hash pin.
    for (const item of GRADE4_MATH_ONTOLOGY_RELEASE.items) expect(composed.release.items).toContainEqual(item);
    expect(composed.release.contentBindings).toEqual([expect.objectContaining({
      contentId: GRADE4_FRACTIONS_LESSON_2026_2.contentId, contentVersion: "1.1.0", contentSha256: lessonPayloadSha256(GRADE4_FRACTIONS_LESSON_2026_2.payload) })]);
    expect(composed.included.filter((entry) => entry.moeObjectiveId === PARTS_OF_A_SET).map((entry) => entry.id)).toEqual([
      GRADE4_FRACTIONS_LESSON_2026_2.contentId, "g4-frac-practice-part-of-whole", "g4-frac-practice-part-of-set",
      "g4-frac-practice-unequal-parts", "g4-frac-check-denominator-meaning"]);

    // An approval of a different identity, or with no reviewer, does not execute.
    expect(composeGrade4MathRelease2026_2({ ledger: approvedLedger, approval: { ...approval, approvedIdentity: "0".repeat(64) } }).executable).toBe(false);
    expect(composeGrade4MathRelease2026_2({ ledger: approvedLedger, approval: { ...approval, reviewer: " " } }).executable).toBe(false);
    expect(composeGrade4MathRelease2026_2({ ledger, approval }).executable).toBe(false);
  });

  it("keeps an APPROVED draft out until its promotion is authored (simulated)", () => {
    const draft = GRADE4_MATH_DRAFT_LESSONS[0];
    const composed = composeGrade4MathRelease2026_2({ ledger: simulatedLedger({ [draft.moeObjectiveId]: "APPROVE" }) });
    expect(composed.excluded.find((entry) => entry.id === draft.contentId)?.reason).toBe("APPROVED draft has no authored promotion (concept + governed items) yet");
  });
});
