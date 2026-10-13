/**
 * SYNTHETIC TEST FIXTURE — not curriculum, not published, not MOE-approved.
 *
 * Shapes the intended first vertical (Grade 4 Mathematics — Fractions) as a ContentBundle V1 so
 * the contract can be exercised end to end: objective → lesson → guided/independent practice →
 * classwork/homework → formative check → unit assessment. Every id carries a `fixture.` prefix and
 * the release identity is marked FIXTURE-ONLY. No lab is bound because no fraction lab is
 * certified in the lab registry. Tool ids are real toolkit registry ids.
 */
import { createHash } from "crypto";
import { CONTENT_BUNDLE_SCHEMA_VERSION, type AccessibilityMetadata, type ContentBundleV1 } from "../types";

const syntheticSha256 = (label: string) => createHash("sha256").update(`fixture:${label}`, "utf8").digest("hex");

const OBJ_EQUIVALENT = "fixture.obj.g4-math.fractions.equivalent";
const OBJ_COMPARE = "fixture.obj.g4-math.fractions.compare";

export const G4_FRACTIONS_FIXTURE_IDS = {
  bundleId: "fixture.bundle.g4-math.fractions",
  unitId: "fixture.unit.g4-math.fractions",
  objectives: { equivalent: OBJ_EQUIVALENT, compare: OBJ_COMPARE },
  lesson: "fixture.lesson.g4-math.fractions.equivalent",
  guidedPractice: "fixture.activity.g4-math.fractions.guided-practice",
  independentPractice: "fixture.activity.g4-math.fractions.independent-practice",
  classwork: "fixture.activity.g4-math.fractions.classwork",
  homework: "fixture.activity.g4-math.fractions.homework",
  formativeCheck: "fixture.assessment.g4-math.fractions.formative-check",
  unitAssessment: "fixture.assessment.g4-math.fractions.unit-assessment",
  resources: {
    fractionStrips: "fixture.resource.g4-math.fraction-strips",
    worksheet: "fixture.resource.g4-math.fractions-worksheet",
    teacherNote: "fixture.resource.g4-math.fractions-teacher-note",
    answerKey: "fixture.resource.g4-math.fractions-unit-answer-key",
  },
} as const;

const ids = G4_FRACTIONS_FIXTURE_IDS;
const V = "1.0.0-fixture";

const accessible: AccessibilityMetadata = {
  readingLevel: "grade-4",
  supportsScreenReader: true,
  supportsReadAloud: true,
  requiresColorVision: false,
  requiresFineMotor: false,
  alternativeFormatResourceIds: [],
};

export function buildGrade4FractionsFixture(): ContentBundleV1 {
  return {
    schemaVersion: CONTENT_BUNDLE_SCHEMA_VERSION,
    identity: { bundleId: ids.bundleId, version: V, title: "FIXTURE — Grade 4 Mathematics: Fractions", gradeLevel: 4, subject: "mathematics", locale: "en-LR" },
    curriculumAuthority: {
      releaseId: "fixture.release.g4-math.synthetic",
      releaseIdentity: "FIXTURE-ONLY:g4-math-fractions@synthetic-0",
      objectiveIds: [OBJ_EQUIVALENT, OBJ_COMPARE],
      standardIds: ["fixture.standard.g4-math.number-fractions"],
    },
    sequence: {
      units: [
        {
          unitId: ids.unitId,
          unitVersion: V,
          title: "Fractions",
          order: 0,
          prerequisiteUnitIds: [],
          entries: [
            { itemId: ids.lesson, order: 0, prerequisiteItemIds: [], unlocksItemIds: [ids.guidedPractice] },
            { itemId: ids.guidedPractice, order: 1, prerequisiteItemIds: [ids.lesson], unlocksItemIds: [ids.independentPractice] },
            { itemId: ids.independentPractice, order: 2, prerequisiteItemIds: [ids.guidedPractice], unlocksItemIds: [] },
            { itemId: ids.formativeCheck, order: 3, prerequisiteItemIds: [ids.independentPractice], unlocksItemIds: [] },
            { itemId: ids.classwork, order: 4, prerequisiteItemIds: [ids.lesson], unlocksItemIds: [] },
            { itemId: ids.homework, order: 5, prerequisiteItemIds: [ids.classwork], unlocksItemIds: [] },
            { itemId: ids.unitAssessment, order: 6, prerequisiteItemIds: [ids.formativeCheck, ids.homework], unlocksItemIds: [] },
          ],
        },
      ],
    },
    lessons: [
      {
        identity: { itemId: ids.lesson, itemVersion: V, itemKind: "LESSON" },
        title: "Equivalent fractions with fraction strips",
        objectiveIds: [OBJ_EQUIVALENT, OBJ_COMPARE],
        estimatedMinutes: 35,
        resourceIds: [ids.resources.fractionStrips, ids.resources.teacherNote],
      },
    ],
    activities: [
      {
        identity: { itemId: ids.guidedPractice, itemVersion: V, itemKind: "PRACTICE" },
        title: "Guided practice: build equal fractions",
        objectiveIds: [OBJ_EQUIVALENT],
        lessonItemIds: [ids.lesson],
        scaffolding: "GUIDED",
        instructions: {
          learner: [
            { stepId: "g1", text: "Lay the 1/2 strip under the whole strip.", resourceIds: [ids.resources.fractionStrips] },
            { stepId: "g2", text: "Find how many 1/4 strips cover the same length as 1/2.", resourceIds: [] },
          ],
          teacher: [{ stepId: "t1", text: "Model the first comparison before pairs continue.", resourceIds: [ids.resources.teacherNote] }],
        },
        resourceIds: [ids.resources.fractionStrips],
        rubric: null,
        expectedDurationMinutes: 10,
        collaborationMode: "PAIR",
        evidenceIntent: { kind: "PRACTICE_ONLY", forms: ["OBSERVATION"] },
        accessibility: accessible,
      },
      {
        identity: { itemId: ids.independentPractice, itemVersion: V, itemKind: "PRACTICE" },
        title: "Independent practice: equal or not equal?",
        objectiveIds: [OBJ_EQUIVALENT, OBJ_COMPARE],
        lessonItemIds: [ids.lesson],
        scaffolding: "INDEPENDENT",
        instructions: { learner: [{ stepId: "i1", text: "Decide whether each pair of fractions is equal. Use the fraction visualizer if you need it.", resourceIds: [] }], teacher: [] },
        resourceIds: [],
        rubric: null,
        expectedDurationMinutes: 10,
        collaborationMode: "INDIVIDUAL",
        evidenceIntent: { kind: "FORMATIVE", forms: ["DIGITAL_RESPONSE"] },
        accessibility: accessible,
      },
      {
        identity: { itemId: ids.classwork, itemVersion: V, itemKind: "CLASSWORK" },
        title: "Classwork: fraction strip worksheet",
        objectiveIds: [OBJ_EQUIVALENT],
        lessonItemIds: [ids.lesson],
        scaffolding: null,
        instructions: { learner: [{ stepId: "c1", text: "Complete questions 1–6 on the worksheet.", resourceIds: [ids.resources.worksheet] }], teacher: [] },
        resourceIds: [ids.resources.worksheet],
        rubric: { rubricId: "fixture.rubric.g4-math.fractions-worksheet", rubricVersion: V, learnerVisibleCriteria: ["Shows the strips used", "Writes the equal fraction"], scoringGuideResourceId: ids.resources.answerKey },
        expectedDurationMinutes: 20,
        collaborationMode: "INDIVIDUAL",
        evidenceIntent: { kind: "FORMATIVE", forms: ["WRITTEN"] },
        accessibility: accessible,
      },
      {
        identity: { itemId: ids.homework, itemVersion: V, itemKind: "HOMEWORK" },
        title: "Homework: fractions at home",
        objectiveIds: [OBJ_COMPARE],
        lessonItemIds: [ids.lesson],
        scaffolding: null,
        instructions: { learner: [{ stepId: "h1", text: "Fold a sheet of paper into halves, then quarters. Write which fractions are equal.", resourceIds: [] }], teacher: [] },
        resourceIds: [],
        rubric: null,
        expectedDurationMinutes: 15,
        collaborationMode: "INDIVIDUAL",
        evidenceIntent: { kind: "PRACTICE_ONLY", forms: ["WRITTEN", "PHOTO"] },
        accessibility: { ...accessible, requiresFineMotor: true },
      },
    ],
    assessments: [
      {
        identity: { itemId: ids.formativeCheck, itemVersion: V, itemKind: "ASSESSMENT" },
        role: "FORMATIVE_CHECK",
        title: "Check: equivalent fractions",
        objectiveIds: [OBJ_EQUIVALENT],
        definition: { definitionId: "fixture.assessment-definition.g4-fractions.check", definitionVersion: V },
        items: [
          { assessmentItemId: "fixture.assessment-item.g4-fractions.check-1", assessmentItemVersion: V },
          { assessmentItemId: "fixture.assessment-item.g4-fractions.check-2", assessmentItemVersion: V },
        ],
        learnerInstructions: ["Answer two short questions."],
        secured: { answerKeyResourceId: null, scoringGuideResourceId: null },
      },
      {
        identity: { itemId: ids.unitAssessment, itemVersion: V, itemKind: "ASSESSMENT" },
        role: "UNIT_ASSESSMENT",
        title: "Unit assessment: fractions",
        objectiveIds: [OBJ_EQUIVALENT, OBJ_COMPARE],
        definition: { definitionId: "fixture.assessment-definition.g4-fractions.unit", definitionVersion: V },
        items: [{ assessmentItemId: "fixture.assessment-item.g4-fractions.unit-1", assessmentItemVersion: V }],
        learnerInstructions: ["Work on your own. You may not use the fraction visualizer."],
        secured: { answerKeyResourceId: ids.resources.answerKey, scoringGuideResourceId: null },
      },
    ],
    labs: [],
    resources: [
      { resourceId: ids.resources.fractionStrips, resourceVersion: V, kind: "MANIPULATIVE", audience: "LEARNER", title: "Fraction strips", locale: "en-LR", assetId: "fixture.asset.fraction-strips" },
      { resourceId: ids.resources.worksheet, resourceVersion: V, kind: "WORKSHEET", audience: "LEARNER", title: "Fraction strip worksheet", locale: "en-LR", assetId: "fixture.asset.fractions-worksheet" },
      { resourceId: ids.resources.teacherNote, resourceVersion: V, kind: "TEACHER_NOTE", audience: "TEACHER", title: "Facilitation note", locale: "en-LR", assetId: null },
      { resourceId: ids.resources.answerKey, resourceVersion: V, kind: "ANSWER_KEY", audience: "TEACHER", title: "Unit answer key", locale: "en-LR", assetId: "fixture.asset.fractions-answer-key" },
    ],
    toolkitBindings: [
      { toolId: "fraction-visualizer", mode: "OPTIONAL", scope: { kind: "BUNDLE" }, configuration: { maxDenominator: 12 }, internalConfiguration: {}, context: "Use strips to check equality." },
      { toolId: "fraction-visualizer", mode: "PROHIBITED", scope: { kind: "ITEM", itemId: ids.unitAssessment }, configuration: {}, internalConfiguration: { enforcement: "server" }, context: null },
      { toolId: "basic-calculator", mode: "PROHIBITED", scope: { kind: "ITEM", itemId: ids.unitAssessment }, configuration: {}, internalConfiguration: {}, context: null },
    ],
    learnerSupport: {
      remediation: [{ supportId: "fixture.support.g4-fractions.revisit-strips", objectiveIds: [OBJ_EQUIVALENT], itemIds: [ids.guidedPractice], resourceIds: [ids.resources.fractionStrips] }],
      enrichment: [{ supportId: "fixture.support.g4-fractions.thirds-sixths", objectiveIds: [OBJ_COMPARE], itemIds: [ids.independentPractice], resourceIds: [] }],
      accommodations: [
        { accommodationId: "fixture.accommodation.read-aloud", kind: "READ_ALOUD", presentation: { voiceRate: 0.9 } },
        { accommodationId: "fixture.accommodation.large-print", kind: "LARGE_PRINT", presentation: { minFontPx: 22 } },
      ],
      languageVariants: [],
    },
    renderings: [
      { renderingId: "fixture.rendering.g4-fractions.workbook", kind: "WORKBOOK", artifactVersion: V, artifactSha256: syntheticSha256("workbook"), audience: "LEARNER", derivation: "DERIVED", sourceAuthority: false },
      { renderingId: "fixture.rendering.g4-fractions.teacher-guide", kind: "TEACHER_GUIDE", artifactVersion: V, artifactSha256: syntheticSha256("teacher-guide"), audience: "TEACHER", derivation: "DERIVED", sourceAuthority: false },
    ],
    offline: {
      packageable: true,
      assets: [
        { assetId: "fixture.asset.fraction-strips", assetVersion: V, sha256: syntheticSha256("fraction-strips"), byteSize: 48_213, mediaType: "image/svg+xml", audience: "LEARNER" },
        { assetId: "fixture.asset.fractions-worksheet", assetVersion: V, sha256: syntheticSha256("worksheet"), byteSize: 120_400, mediaType: "application/pdf", audience: "LEARNER" },
        { assetId: "fixture.asset.fractions-answer-key", assetVersion: V, sha256: syntheticSha256("answer-key"), byteSize: 30_112, mediaType: "application/pdf", audience: "TEACHER" },
      ],
      capabilityRestrictions: ["NO_AI_TUTOR", "NO_SUMMATIVE_ASSESSMENT"],
      reconnectRequirement: { requiredFor: ["SUBMISSION_SYNC", "SUMMATIVE_ASSESSMENT"], maxOfflineDays: 14 },
    },
    governance: {
      provenance: { sourceIds: ["fixture.source.synthetic"], generatorRunId: null },
      reviewIds: [],
      releaseRecordId: null,
      reviewerNotes: ["FIXTURE: internal note that must never reach learners."],
    },
  };
}
