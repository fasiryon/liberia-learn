import { describe, expect, it } from "vitest";
import {
  assertGenerationApproved,
  assertNoDuplicatePlannedLessons,
  buildDraftLessonSkeleton,
  buildMissingCurriculumPlan,
  estimateMissingCurriculumCost,
  validateDraftLessonSkeleton,
} from "@/lib/curriculum/missingContentPlan";
import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import type { YearReadinessRow } from "@/lib/curriculum/yearPlan";

function row(overrides: Partial<YearReadinessRow>): YearReadinessRow {
  return {
    grade: 4,
    subject: "MATH",
    totalLessons: 30,
    mappedLessons: 30,
    approvedMappedLessons: 30,
    draftMappedLessons: 0,
    totalMappedLessons: 30,
    draftGeneratedCoverageLabel: "Draft generated coverage - pending review",
    readinessPct: 17,
    draftReadinessPct: 0,
    totalReadinessPct: 17,
    weeksCovered: 6,
    unitsCovered: 2,
    missingWeeks: [7, 8, 9],
    missingAssessments: 3,
    missingTeacherGuides: 2,
    missingWorksheets: 2,
    missingAudio: 30,
    missingLabs: 0,
    classification: "PARTIAL",
    ...overrides,
  };
}

describe("missing curriculum content planning", () => {
  it("dry-run planning selects only gaps and produces no write intent", () => {
    const plan = buildMissingCurriculumPlan([
      row({ grade: 1, subject: "MATH", classification: "STRONG", mappedLessons: 180, approvedMappedLessons: 180, totalMappedLessons: 180, readinessPct: 100, totalReadinessPct: 100 }),
      row({ grade: 2, subject: "SCIENCE", classification: "PARTIAL", mappedLessons: 55, readinessPct: 31 }),
    ]);

    expect(plan.generatedContent).toBe(false);
    expect(plan.dryRunOnly).toBe(true);
    expect(plan.skippedStrongGroups).toBe(1);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].subject).toBe("SCIENCE");
  });

  it("keeps 16 of 180 mapped lessons eligible even when classification is STRONG", () => {
    const plan = buildMissingCurriculumPlan([
      row({
        grade: 5,
        subject: "ENGLISH",
        classification: "STRONG",
        totalLessons: 65,
        mappedLessons: 16,
        approvedMappedLessons: 1,
        draftMappedLessons: 15,
        totalMappedLessons: 16,
        readinessPct: 1,
        draftReadinessPct: 8,
        totalReadinessPct: 9,
      }),
    ], { limit: 10 });

    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].lessonsNeeded).toBe(164);
    expect(plan.lessons).toHaveLength(10);
  });

  it("does not plan generation when total mapped coverage reaches 180 of 180", () => {
    const plan = buildMissingCurriculumPlan([
      row({
        classification: "PARTIAL",
        mappedLessons: 180,
        approvedMappedLessons: 120,
        draftMappedLessons: 60,
        totalMappedLessons: 180,
        readinessPct: 67,
        draftReadinessPct: 33,
        totalReadinessPct: 100,
      }),
    ]);

    expect(plan.lessons).toHaveLength(0);
    expect(plan.groups).toHaveLength(0);
  });

  it("counts approved and draft coverage toward total mapped lesson planning", () => {
    const plan = buildMissingCurriculumPlan([
      row({
        mappedLessons: 16,
        approvedMappedLessons: 1,
        draftMappedLessons: 15,
        totalMappedLessons: 16,
      }),
    ], { limit: 1 });

    expect(plan.groups[0].mappedLessons).toBe(16);
    expect(plan.groups[0].lessonsNeeded).toBe(164);
    expect(plan.lessons[0].plannedContentId).toContain("w04-d2");
  });

  it("generates a cost estimate from planned lessons", () => {
    const plan = buildMissingCurriculumPlan([row({ mappedLessons: 170, totalMappedLessons: 170, readinessPct: 94, totalReadinessPct: 94 })]);
    const estimate = estimateMissingCurriculumCost(plan);

    expect(estimate.lessonCount).toBe(10);
    expect(estimate.totalTokensPerLesson).toBe(6000);
    expect(estimate.totalTokens).toBe(60000);
    expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("prevents duplicate planned content ids", () => {
    const plan = buildMissingCurriculumPlan([row({ grade: 3, subject: "MATH", mappedLessons: 175 })]);

    assertNoDuplicatePlannedLessons(plan);
    expect(new Set(plan.lessons.map((lesson) => lesson.plannedContentId)).size).toBe(plan.lessons.length);
  });

  it("builds a valid draft lesson skeleton with review trust metadata", () => {
    const plan = buildMissingCurriculumPlan([row({ subject: "SCIENCE", mappedLessons: 33, readinessPct: 18 })], { limit: 1 });
    const draft = buildDraftLessonSkeleton(plan.lessons[0]);

    expect(validateDraftLessonSkeleton(draft)).toBe(true);
    expect(draft.status).toBe("DRAFT");
    expect(draft.payload.trustSignal.reviewStatus).toBe("NEEDS_REVIEW");
    expect(draft.payload.trustSignal.routedCompletionRequired).toBe(true);
    expect(draft.payload.trustSignal.promptRegistryRequired).toBe(true);
  });

  it("does not treat day 5 as an automatic assessment", () => {
    const plan = buildMissingCurriculumPlan([row({ subject: "ENGLISH", mappedLessons: 4, totalMappedLessons: 4, readinessPct: 3, totalReadinessPct: 3 })], { limit: 1 });

    expect(plan.lessons[0]).toMatchObject({
      dayNumber: 5,
      lessonType: "CORE",
    });
  });

  it("registers the Phase 6 missing-content prompt", () => {
    const metadata = getPromptMetadata("curriculum.missingContent.v1");

    expect(metadata.key).toBe("curriculum.missingContent.v1");
    expect(metadata.approvedDynamic).toBe(true);
  });

  it("includes explicit lessonType rules in the missing-content user prompt", () => {
    const prompt = buildPrompt("curriculum.missingContent.user.v1", {
      grade: 5,
      subject: "ENGLISH",
      topic: "Using Dialogue in Stories",
      weekNumber: 1,
      unit: "Grade 5 ENGLISH Week 1",
      dayNumber: 5,
      lessonType: "CORE",
      contentId: "draft-phase6-g5-english-w01-d5-core",
      gapReason: "test",
      existingTitles: "Using Dialogue to Bring Stories to Life",
    });

    expect(prompt).toContain("The lessonType is CORE.");
    expect(prompt).toContain("Do not infer lesson type from dayNumber.");
    expect(prompt).toContain("ASSESSMENT applies only when lessonType is exactly ASSESSMENT.");
  });

  it("requires human approval outside dry-run mode", () => {
    expect(() => assertGenerationApproved({ dryRun: false })).toThrow(/approval/i);
    expect(() => assertGenerationApproved({ dryRun: false, approved: true })).not.toThrow();
    expect(() => assertGenerationApproved({ dryRun: true })).not.toThrow();
  });

  it("supports resumable execution by skipping completed planned ids", () => {
    const initial = buildMissingCurriculumPlan([row({ mappedLessons: 178, totalMappedLessons: 178 })]);
    const resumed = buildMissingCurriculumPlan([row({ mappedLessons: 178, totalMappedLessons: 178 })], {
      completedContentIds: [initial.lessons[0].plannedContentId],
    });

    expect(initial.lessons).toHaveLength(2);
    expect(resumed.lessons).toHaveLength(1);
    expect(resumed.lessons[0].plannedContentId).not.toBe(initial.lessons[0].plannedContentId);
  });
});
