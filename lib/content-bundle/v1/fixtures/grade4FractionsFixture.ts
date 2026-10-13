/**
 * SYNTHETIC TEST FIXTURE: not curriculum, not a published release, not reviewed, not MOE-approved.
 *
 * Shapes the first governed vertical named by CONTENT_FACTORY_READINESS_V1 §11 (Grade 4
 * Mathematics, Fractions: parts of a set, starting from equal parts) as a ContentBundle V1 so the
 * contract can be exercised end to end:
 *
 *   objective → lesson → practice (guided, independent) → classwork / homework
 *   → formative check → unit assessment
 *
 * It deliberately does NOT reuse the real release, objective or lesson identifiers
 * (`lr-moe-g4-math-fractions-2026.1`, `moe-math-g4-...-obj4`, `ll-g4-math-fractions-equal-parts-2026.1`):
 * the readiness decision assigns a real bundle version and hash only after reviewed dependencies
 * exist. Every id here carries a `fixture.` prefix and the release identity is FIXTURE-ONLY.
 * There is no lab, because the first vertical excludes labs and the certified registry is empty.
 *
 * Tools use canonical governed ids (the namespace of the Grade 4 tool policies: `fraction_strips`,
 * `calculator`). `G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING` is an UNREVIEWED test mapping to runtime
 * registry ids. Readiness requires pedagogical equivalence review for fraction_strips →
 * fraction-visualizer, so this mapping is not that review.
 */
import { createHash } from "crypto";
import { CONTENT_BUNDLE_SCHEMA_VERSION, type AccessibilityMetadata, type ContentBundleV1 } from "../types";
import type { ToolkitMapping } from "../toolkitMapping";

const syntheticSha256 = (label: string) => createHash("sha256").update(`fixture:${label}`, "utf8").digest("hex");

const OBJ_PARTS_OF_SET = "fixture.obj.g4-math.fractions.parts-of-a-set";
const OBJ_EQUAL_PARTS = "fixture.obj.g4-math.fractions.equal-parts";

export const G4_FRACTIONS_FIXTURE_IDS = {
  bundleId: "fixture.bundle.g4-math-fractions",
  unitId: "fixture.unit.g4-math-fractions",
  objectives: { partsOfSet: OBJ_PARTS_OF_SET, equalParts: OBJ_EQUAL_PARTS },
  lesson: "fixture.lesson.g4-math.fractions.parts-of-a-set",
  guidedPractice: "fixture.activity.g4-math.fractions.guided-practice",
  independentPractice: "fixture.activity.g4-math.fractions.independent-practice",
  classwork: "fixture.activity.g4-math.fractions.classwork",
  homework: "fixture.activity.g4-math.fractions.homework",
  formativeCheck: "fixture.assessment.g4-math.fractions.formative-check",
  unitAssessment: "fixture.assessment.g4-math.fractions.unit-assessment",
  resources: {
    counters: "fixture.resource.g4-math.bottle-cap-counters",
    worksheet: "fixture.resource.g4-math.parts-of-a-set-worksheet",
    teacherNote: "fixture.resource.g4-math.parts-of-a-set-teacher-note",
    answerKey: "fixture.resource.g4-math.fractions-unit-answer-key",
  },
  tools: { fractionStrips: "fraction_strips", calculator: "calculator" },
} as const;

export const G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING: ToolkitMapping = {
  mappingId: "fixture.toolkit-mapping.g4-math",
  mappingVersion: "0.0.0-fixture-unreviewed",
  entries: {
    fraction_strips: ["fraction-visualizer"],
    number_line: ["number-line"],
    // A prohibition group: both runtime calculators.
    calculator: ["basic-calculator", "scientific-calculator"],
  },
};

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
    identity: { bundleId: ids.bundleId, version: V, title: "FIXTURE: Grade 4 Mathematics, Fractions (parts of a set)", gradeLevel: 4, subject: "mathematics", locale: "en-LR", contentHash: null },
    curriculumAuthority: {
      releaseId: "fixture.release.g4-math-fractions.synthetic",
      releaseIdentity: "FIXTURE-ONLY:g4-math-fractions@synthetic-0",
      objectiveIds: [OBJ_PARTS_OF_SET, OBJ_EQUAL_PARTS],
      standardIds: ["fixture.standard.g4-math.number-fractions"],
      sourceVersionRefs: ["fixture.source-version.g4-math-syllabus.synthetic"],
      conceptRefs: ["fixture.concept.g4-fractions-equal-parts", "fixture.concept.g4-fractions-parts-of-a-set"],
      constructBindingRefs: ["fixture.construct-binding.g4-fractions.parts-of-a-set"],
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
            { itemId: ids.lesson, order: 0, requirement: "REQUIRED", prerequisiteItemIds: [], unlocksItemIds: [ids.guidedPractice] },
            { itemId: ids.guidedPractice, order: 1, requirement: "REQUIRED", prerequisiteItemIds: [ids.lesson], unlocksItemIds: [ids.independentPractice] },
            { itemId: ids.independentPractice, order: 2, requirement: "REQUIRED", prerequisiteItemIds: [ids.guidedPractice], unlocksItemIds: [] },
            { itemId: ids.formativeCheck, order: 3, requirement: "REQUIRED", prerequisiteItemIds: [ids.independentPractice], unlocksItemIds: [] },
            { itemId: ids.classwork, order: 4, requirement: "REQUIRED", prerequisiteItemIds: [ids.lesson], unlocksItemIds: [] },
            { itemId: ids.homework, order: 5, requirement: "OPTIONAL", prerequisiteItemIds: [ids.classwork], unlocksItemIds: [] },
            { itemId: ids.unitAssessment, order: 6, requirement: "REQUIRED", prerequisiteItemIds: [ids.formativeCheck, ids.classwork], unlocksItemIds: [] },
          ],
        },
      ],
    },
    lessons: [
      {
        identity: { itemId: ids.lesson, itemVersion: V, itemKind: "LESSON" },
        title: "Fractions of a set: equal groups of bottle caps",
        objectiveIds: [OBJ_PARTS_OF_SET, OBJ_EQUAL_PARTS],
        estimatedMinutes: 35,
        resourceIds: [ids.resources.counters, ids.resources.teacherNote],
      },
    ],
    activities: [
      {
        identity: { itemId: ids.guidedPractice, itemVersion: V, itemKind: "PRACTICE" },
        title: "Guided practice: share bottle caps into equal groups",
        objectiveIds: [OBJ_EQUAL_PARTS],
        lessonItemIds: [ids.lesson],
        scaffolding: "GUIDED",
        instructions: {
          learner: [
            { stepId: "g1", text: "Put 12 bottle caps into 4 equal groups.", resourceIds: [ids.resources.counters] },
            { stepId: "g2", text: "How many caps are in 1 of the 4 groups? Write it as a fraction of the set.", resourceIds: [] },
          ],
          teacher: [{ stepId: "t1", text: "Model the first sharing before pairs continue.", resourceIds: [ids.resources.teacherNote] }],
        },
        resourceIds: [ids.resources.counters],
        rubric: null,
        expectedDurationMinutes: 10,
        collaborationMode: "PAIR",
        evidenceIntent: { kind: "PRACTICE_ONLY", forms: ["OBSERVATION"] },
        accessibility: accessible,
      },
      {
        identity: { itemId: ids.independentPractice, itemVersion: V, itemKind: "PRACTICE" },
        title: "Independent practice: name the fraction of the set",
        objectiveIds: [OBJ_PARTS_OF_SET],
        lessonItemIds: [ids.lesson],
        scaffolding: "INDEPENDENT",
        instructions: { learner: [{ stepId: "i1", text: "For each picture, write what fraction of the set is shaded. Use fraction strips if you need them.", resourceIds: [] }], teacher: [] },
        resourceIds: [],
        rubric: null,
        expectedDurationMinutes: 10,
        collaborationMode: "INDIVIDUAL",
        evidenceIntent: { kind: "FORMATIVE", forms: ["DIGITAL_RESPONSE"] },
        accessibility: accessible,
      },
      {
        identity: { itemId: ids.classwork, itemVersion: V, itemKind: "CLASSWORK" },
        title: "Classwork: parts of a set worksheet",
        objectiveIds: [OBJ_PARTS_OF_SET],
        lessonItemIds: [ids.lesson],
        scaffolding: null,
        instructions: { learner: [{ stepId: "c1", text: "Complete questions 1 to 6 on the worksheet.", resourceIds: [ids.resources.worksheet] }], teacher: [] },
        resourceIds: [ids.resources.worksheet],
        rubric: { rubricId: "fixture.rubric.g4-math.parts-of-a-set-worksheet", rubricVersion: V, learnerVisibleCriteria: ["Draws the equal groups", "Writes the fraction of the set"], scoringGuideResourceId: ids.resources.answerKey },
        expectedDurationMinutes: 20,
        collaborationMode: "INDIVIDUAL",
        evidenceIntent: { kind: "FORMATIVE", forms: ["WRITTEN"] },
        accessibility: accessible,
      },
      {
        identity: { itemId: ids.homework, itemVersion: V, itemKind: "HOMEWORK" },
        title: "Homework: fractions of a set at home",
        objectiveIds: [OBJ_PARTS_OF_SET],
        lessonItemIds: [ids.lesson],
        scaffolding: null,
        instructions: { learner: [{ stepId: "h1", text: "Find 8 small objects at home. Show 1/4 of the set and draw what you did.", resourceIds: [] }], teacher: [] },
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
        title: "Check: fraction of a set",
        objectiveIds: [OBJ_PARTS_OF_SET],
        definition: { definitionId: "fixture.assessment-definition.g4-fractions.check", definitionVersion: V },
        items: [
          { assessmentItemId: "fixture.assessment-item.g4-fractions.check-1", assessmentItemVersion: V },
          { assessmentItemId: "fixture.assessment-item.g4-fractions.check-2", assessmentItemVersion: V },
        ],
        itemOrder: { kind: "FIXED" },
        learnerInstructions: ["Answer two short questions."],
        secured: { answerKeyResourceId: null, scoringGuideResourceId: null },
      },
      {
        identity: { itemId: ids.unitAssessment, itemVersion: V, itemKind: "ASSESSMENT" },
        role: "UNIT_ASSESSMENT",
        title: "Unit assessment: fractions",
        objectiveIds: [OBJ_PARTS_OF_SET, OBJ_EQUAL_PARTS],
        definition: { definitionId: "fixture.assessment-definition.g4-fractions.unit", definitionVersion: V },
        items: [
          { assessmentItemId: "fixture.assessment-item.g4-fractions.unit-1", assessmentItemVersion: V },
          { assessmentItemId: "fixture.assessment-item.g4-fractions.unit-2", assessmentItemVersion: V },
          { assessmentItemId: "fixture.assessment-item.g4-fractions.unit-3", assessmentItemVersion: V },
        ],
        itemOrder: { kind: "FIXED" },
        learnerInstructions: ["Work on your own. Tools are not allowed."],
        secured: { answerKeyResourceId: ids.resources.answerKey, scoringGuideResourceId: null },
      },
    ],
    labs: [],
    resources: [
      { resourceId: ids.resources.counters, resourceVersion: V, kind: "MANIPULATIVE", audience: "LEARNER", title: "Bottle-cap counters", locale: "en-LR", assetId: "fixture.asset.bottle-cap-counters" },
      { resourceId: ids.resources.worksheet, resourceVersion: V, kind: "WORKSHEET", audience: "LEARNER", title: "Parts of a set worksheet", locale: "en-LR", assetId: "fixture.asset.parts-of-a-set-worksheet" },
      { resourceId: ids.resources.teacherNote, resourceVersion: V, kind: "TEACHER_NOTE", audience: "TEACHER", title: "Facilitation note", locale: "en-LR", assetId: null },
      { resourceId: ids.resources.answerKey, resourceVersion: V, kind: "ANSWER_KEY", audience: "TEACHER", title: "Unit answer key", locale: "en-LR", assetId: "fixture.asset.fractions-answer-key" },
    ],
    toolkitBindings: [
      { toolId: ids.tools.fractionStrips, mode: "OPTIONAL", scope: { kind: "BUNDLE" }, configuration: { maxDenominator: 12 }, internalConfiguration: {}, context: "Use strips to check equal parts." },
      { toolId: ids.tools.fractionStrips, mode: "PROHIBITED", scope: { kind: "ITEM", itemId: ids.unitAssessment }, configuration: {}, internalConfiguration: { enforcement: "server" }, context: null },
      { toolId: ids.tools.calculator, mode: "PROHIBITED", scope: { kind: "BUNDLE" }, configuration: {}, internalConfiguration: {}, context: null },
    ],
    toolkitMapping: { mappingId: G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING.mappingId, mappingVersion: G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING.mappingVersion },
    learnerSupport: {
      remediation: [{ supportId: "fixture.support.g4-fractions.revisit-equal-groups", objectiveIds: [OBJ_EQUAL_PARTS], itemIds: [ids.guidedPractice], resourceIds: [ids.resources.counters] }],
      enrichment: [{ supportId: "fixture.support.g4-fractions.larger-sets", objectiveIds: [OBJ_PARTS_OF_SET], itemIds: [ids.independentPractice], resourceIds: [] }],
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
        { assetId: "fixture.asset.bottle-cap-counters", assetVersion: V, sha256: syntheticSha256("bottle-cap-counters"), byteSize: 48_213, mediaType: "image/svg+xml", audience: "LEARNER" },
        { assetId: "fixture.asset.parts-of-a-set-worksheet", assetVersion: V, sha256: syntheticSha256("worksheet"), byteSize: 120_400, mediaType: "application/pdf", audience: "LEARNER" },
        { assetId: "fixture.asset.fractions-answer-key", assetVersion: V, sha256: syntheticSha256("answer-key"), byteSize: 30_112, mediaType: "application/pdf", audience: "TEACHER" },
      ],
      allowedCapabilities: ["LESSON_PLAYBACK", "FORMATIVE_PRACTICE", "RESPONSE_QUEUE", "LOCAL_TOOLS"],
      reconnectSemantics: { requiredFor: ["SUBMISSION_SYNC", "SUMMATIVE_ASSESSMENT"], maxOfflineDays: 14 },
    },
    governance: {
      provenanceRefs: ["fixture.provenance.synthetic"],
      reviewRefs: [],
      lifecycleRefs: [],
      releaseRefs: [],
    },
  };
}
