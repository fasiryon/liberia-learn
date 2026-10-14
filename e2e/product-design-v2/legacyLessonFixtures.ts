/**
 * Synthetic LEGACY Grade 7 lesson for the browser harness. Shaped like the existing legacy detail APIs
 * (GET /api/curriculum/:contentId and GET /api/student/work/:id). It is not curriculum content, not a
 * release and not a native Lesson Experience; the delivery seam answers 404 for it, so the route keeps
 * the legacy Read / Slides / Listen path exactly as production does for an unreleased-native lesson.
 */
export const LEGACY_CONTENT_ID = "fixture-g7-place-value-legacy";
export const LEGACY_WORK_ID = "fixture-g7-work";

export const LEGACY_BODY = `Every large number is built from the same ten digits. Where a digit sits tells you how much it is worth. In this lesson you will read and write numbers up to the millions and explain the value of each digit.

## Place and value

The **place** of a digit is its position in the number. The **value** of a digit is how much it is worth in that place.

- Each place is worth ten times the place to its right.
- Moving one place to the left multiplies the value by 10.
- A zero holds a place when that place is empty.

## Reading large numbers

Group the digits in threes from the right: ones, thousands, millions. Read each group, then say its group name.

| Millions | Thousands | Ones |
| --- | --- | --- |
| 4 | 205 | 316 |

The number 4,205,316 is read as "four million, two hundred five thousand, three hundred sixteen".

## Worked example

Musu's school collected 2,350,480 Liberian dollars for a new library. What is the value of the digit 3?

1. Find the 3. It is in the hundred-thousands place.
2. Its value is 3 x 100,000 = 300,000.
3. So the 3 is worth three hundred thousand Liberian dollars.

## Try it yourself

Write the value of the underlined digit 7 in 1,742,009. Then write the number in expanded form.

## Key takeaways

- The value of a digit depends on its place.
- Each place is ten times the place to its right.
- Group digits in threes to read large numbers.`;

export const LEGACY_OBJECTIVES = [
  "Read and write whole numbers up to the millions.",
  "Explain the value of each digit using place value.",
  "Write a number in expanded form.",
];

export function legacyCurriculumResponse() {
  return {
    metadata: { contentId: LEGACY_CONTENT_ID, grade: 7, subject: "MATHEMATICS", version: "1", moeAlignments: ["MATH.7.NS.1"] },
    payload: {
      title: "Place value in large numbers",
      objectives: LEGACY_OBJECTIVES,
      activities: ["Build 2,350,480 on a place-value chart with bottle caps.", "Write three large numbers from a market price list in expanded form."],
      body_standard: LEGACY_BODY,
      studentReady: true,
    },
    audio: { status: "NOT_GENERATED" },
    offlineManifest: null,
  };
}

export function legacyWorkResponse() {
  return {
    id: LEGACY_WORK_ID,
    contentId: LEGACY_CONTENT_ID,
    contentVersion: "1",
    contentHash: null,
    title: "Place value in large numbers",
    subject: "MATHEMATICS",
    grade: 7,
    teacherName: "Ms. Fixture",
    classFormat: "standard",
    schoolName: "Fixture School",
    bodyStandard: LEGACY_BODY,
    bodyBlock: null,
    body: LEGACY_BODY,
    deliveryProfile: { exitTicket: { questions: [
      { question: "What is the value of the 5 in 3,512,004?", type: "mcq", choices: ["5,000", "500,000", "50,000"] },
      { question: "Write 4,060,200 in expanded form.", type: "short_answer" },
    ] } },
    objectives: LEGACY_OBJECTIVES,
    heroImage: null,
    inlineIllustrations: null,
    pseudoLabs: [],
    simulationDefinitions: [],
    status: "not_started",
    completedAt: null,
    audio: { status: "NOT_GENERATED" },
    activeVideo: null,
    takeawaySummary: null,
    problemSets: [],
  };
}

/** Progress summary shaped like GET /api/student/progress. Synthetic; never a real learner. */
export function progressFixture() {
  return {
    totalLessonsCompleted: 6,
    totalLessonsAssigned: 14,
    averageQuizScorePercent: 72,
    currentStreakDays: 3,
    overallCurriculumCompletionPercent: 43,
    subjectProgress: [
      { subject: "MATHEMATICS", label: "Mathematics", completedLessons: 4, totalLessons: 8, completionPercent: 50, latestDerivedScore: 70, latestMasteryState: "DEVELOPING" },
      { subject: "ENGLISH", label: "English", completedLessons: 2, totalLessons: 6, completionPercent: 33, latestDerivedScore: null, latestMasteryState: null },
    ],
    recentActivity: [
      { id: "a1", type: "lesson_completed", title: "Comparing whole numbers", subject: "MATHEMATICS", occurredAt: "2026-10-13T10:00:00Z" },
      { id: "a2", type: "quiz_submitted", title: "Reading for meaning", subject: "ENGLISH", occurredAt: "2026-10-12T14:00:00Z", scorePercent: 80 },
    ],
    badges: [],
    examReadiness: null,
    learningIntelligence: {
      generatedAt: "2026-10-14T08:00:00Z",
      masteryBySubject: [{ subject: "MATHEMATICS", label: "Mathematics", masteryPercent: 61, confidenceTier: "medium", evidenceCount: 7, completedLessons: 4, totalLessons: 8, latestQuizScorePercent: 70, weakConcepts: [{ conceptKey: "pv", label: "Place value", masteryPercent: 48, confidenceTier: "low", evidenceCount: 3 }] }],
      weaknesses: [],
      recommendedNextActions: [{ type: "review_weak_lesson", label: "Review: Place value in large numbers", reason: "Two recent quiz answers on place value were incorrect.", href: `/student/lesson/${LEGACY_CONTENT_ID}`, priority: 1 }],
    },
  };
}
