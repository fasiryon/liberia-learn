// Synthetic legacy lessons for Library Modernization tests. Shapes follow CurriculumContentSnapshotV1
// and the read-only extract record; contents are invented for the tests and are not library lessons.
import type { DependencyCounts, LibraryExtractRecord } from "@/lib/curriculum/modernization/extract";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";

export const NO_DEPENDENCIES: DependencyCounts = Object.freeze({
  scheduledWork: 0, scheduledWorkBundlePinned: 0, scheduledWorkClasses: 0, scheduledWorkSchools: 0, studentProgress: 0, assignments: 0, homework: 0,
  learningEvents: 0, gradedSubmissions: 0, teacherLessonAssignments: 0, lessonPlans: 0, tutorConversations: 0, helpFlags: 0, timetableAssignments: 0,
  performanceEvents: 0, curriculumFlags: 0, lessonVersions: 0, lessonShares: 0, audioAssets: 0, videoSupplements: 0, prerequisiteLinks: 0, dependentLessons: 0,
});

export const SOUND_BODY = `## 1. Hook
At Waterside Market in Monrovia, Musu sells bundles of cassava for 25 LD each.

## 2. Learning Objectives
Add two-digit numbers with regrouping.

## 3. Prior Knowledge Activation
What is 7 + 5? If learners cannot add within 20, review counting on with the class first.

## 4. Core Concept
When the ones add to ten or more, we regroup ten ones as one ten. The ten moves to the tens column, so 27 + 15 has 4 tens and 2 ones. Regrouping keeps every digit in the place that names its value, which is why the answer is 42 and not 312.

## 5. Worked Example 1
Step 1: add the ones, 7 + 5 = 12. Step 2: write 2 and carry one ten. Step 3: add the tens, 2 + 1 + 1 = 4. So 27 + 15 = 42.

## 6. Error Analysis
A learner might say 27 + 15 = 312 by writing each column sum side by side. The error is forgetting to regroup.

## 7. Guided Practice Problem 1
Together: 36 + 48. What do the ones add to?

## 8. Independent Practice
Solve 58 + 27 and 19 + 64. Explain why you regrouped.

## 9. Assessment, Exit Ticket, and Lesson Summary
1. What is 45 + 38?
2. Explain why 45 + 38 is not 713.
`;

type Overrides = Partial<{
  contentId: string; grade: number; subject: string; title: string; body: string; status: string; version: string; moeAlignments: unknown;
  dependencies: Partial<DependencyCounts>; teacherCreated: boolean; quiz: unknown; revisionId: string; extension: unknown;
}>;

export function legacyRecord(overrides: Overrides = {}): LibraryExtractRecord {
  const grade = overrides.grade ?? 4;
  const subject = overrides.subject ?? "MATH";
  const title = overrides.title ?? "Adding Two-Digit Numbers with Regrouping";
  const snapshot = {
    identity: { title, description: null, grade, subject, contentType: "lesson" },
    placement: { unitId: null, orderInUnit: null, lessonType: "core" },
    delivery: { lessonFormat: "standard", estimatedMinutes: 40, deliveryProfile: null, body: overrides.body ?? SOUND_BODY, bodyStandard: null, bodyBlock: null, legacyContent: null, lessonContent: null },
    instruction: {
      objectives: ["Add two-digit numbers with regrouping."], authoringObjectives: null, activities: [], teacherExplanation: null, workedExamples: null,
      guidedPractice: null, independentPractice: null, realWorldApplication: null, teacherNotes: null, remediation: null, extension: overrides.extension ?? null,
      guardianSupport: null, materialsNotes: null, takeawaySummary: null,
    },
    assessment: { assessment: null, assessmentQuestions: [], quiz: overrides.quiz ?? null, problemSets: [], rubric: null, masteryChecks: null },
    resources: { labs: [], textbook: null, resources: null, slideDeckSpecs: [], audioScriptSpecs: [], heroImage: null, inlineIllustrations: [] },
    curriculumPlan: { term: null, unitTitle: null, termPlan: null, weeks: [], units: [], lessons: [] },
    standards: { moeAlignments: overrides.moeAlignments ?? null, waecSyllabusTopics: [] },
  };
  const contentHash = hashCurriculumSnapshot(1, snapshot);
  const contentId = overrides.contentId ?? "fixture-g4-math-regrouping";
  return {
    id: `pk-${contentId}`,
    contentId,
    row: {
      title, grade, subject, contentType: "lesson", status: overrides.status ?? "APPROVED", version: overrides.version ?? "fixture-1", hash: "rowhash",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", publishedAt: null, unitId: null, orderInUnit: null, lessonType: "core",
      teacherCreated: overrides.teacherCreated ?? false, hasSchoolScope: false, hasEditor: false, visibility: "class_only", parentLessonId: null, derivedFromContentId: null,
      lessonVersion: 1, versionId: null, isHero: false, imageGenerationStatus: null, editReviewStatus: null, moeAlignments: overrides.moeAlignments ?? null,
      waecSyllabusTopics: [], payloadKeys: ["body", "title"], payloadMetadata: {}, payloadBytes: 1000,
    },
    provenance: { completeness: "UNVERIFIED", lifecycleState: "APPROVED", revisionCount: 1 },
    revision: {
      id: overrides.revisionId ?? `rev-${contentId}`, sequence: 1, revisionKind: "BACKFILL_SNAPSHOT", originKind: "LEGACY_UNKNOWN", snapshotSchemaVersion: 1,
      contentHash, generatorName: null, generatorVersion: null, aiProvider: null, aiModel: null, generatedAt: null, createdAt: "2026-01-01T00:00:00.000Z", hasAuthor: false,
      contentSnapshot: snapshot,
    },
    liveSnapshot: null,
    verification: { hasProvenance: true, hasCurrentRevision: true, storedRevisionHash: contentHash, recomputedRevisionHash: contentHash, revisionHashMatches: true, liveRowEqualsRevision: true, liveSnapshotHash: contentHash },
    dependencies: { ...NO_DEPENDENCIES, ...(overrides.dependencies ?? {}) },
  };
}
