import { readFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { sealDefinition, sealForm, sealItem } from "@/lib/assessment/v2/hash";
import type { AssessmentPurpose, ProtectedScoringSpec, ScoringKey } from "@/lib/assessment/v2/types";
import type { CandidateLessonV2, CandidateScene, ScaffoldLevel } from "@/lib/curriculum/v2/contract";
import type { ActivityDefinitionV1 } from "@/lib/activity-definition/v1/types";
import { hashActivityDefinition } from "@/lib/activity-definition/v1/hash";
import type { ContentBundleV1 } from "@/lib/content-bundle/v1/types";
import { hashContentBundle } from "@/lib/content-bundle/v1/hash";
import { sealBlueprint, type FactoryRole, type UnitBlueprint } from "./blueprint";
import { runFactory } from "./manager";
import type { AssessmentCandidate, DocumentCandidate, FactoryArtifact, FactoryExecutors, ResourceDraft } from "./types";

const BASE = "a1508ceaf7d89a338de624e9f63c9c4c592ca28c";
const OBJECTIVE = "proposed-g7-number-sense-place-value";
const EXTENSION = "ll-g7-base-generalisation-extension";
const MISCONCEPTION = "mc-longer-decimal-bigger";
const candidateRelease = { releaseId: "UNRESOLVED-G7-CANDIDATE", releaseIdentity: "UNRESOLVED-NOT-A-RELEASE" };

/** Repository demonstration only. No production IDs, curriculum approval or MOE mapping are invented. */
export function demoBlueprint(): UnitBlueprint {
  const sourcePath = "curriculum/excellence/g7-v0.2.0/source.json";
  const sha256 = createHash("sha256").update(readFileSync(path.join(process.cwd(), sourcePath))).digest("hex");
  const source = { id: "g7-existing-gap-report-source", version: "0.2.0", sha256, sourceRef: `git:3b51aef9:${sourcePath}` };
  const template = { id: "factory-local-template", version: "0.1.0", sha256: createHash("sha256").update(readFileSync(path.join(process.cwd(), "lib/content-factory/v2/demo.ts"))).digest("hex"), sourceRef: "repository-candidate:lib/content-factory/v2/demo.ts" };
  const resource = (id: string, kind: UnitBlueprint["resources"][number]["kind"], role: FactoryRole, dependsOn: string[], audience: UnitBlueprint["resources"][number]["audience"] = "LEARNER", objectiveIds = [OBJECTIVE]) => ({ id, kind, role, dependsOn, audience, objectiveIds });
  const task = (id: string, resourceId: string, kind: UnitBlueprint["assessmentPlan"][number]["kind"], timing: UnitBlueprint["assessmentPlan"][number]["timing"], scoring: UnitBlueprint["assessmentPlan"][number]["scoring"], extra: Partial<UnitBlueprint["assessmentPlan"][number]> = {}) => ({
    id, resourceId, itemIds: ["quiz", "summative", "retention", "transfer"].includes(resourceId) ? [`${resourceId}-item-${kind === "EXTENDED_REASONING" ? 2 : 1}`] : [], kind, objectiveIds: [OBJECTIVE], scaffold: "NONE" as const, timing, context: "REHEARSED" as const, scoring, source: "EXCELLENCE_PLAN" as const, ref: `resource:${resourceId}`, ...extra,
  });
  return sealBlueprint({ schemaVersion: "unit-blueprint/2.0.0", blueprintId: "factory-g7-number-sense", version: "0.1.0", grade: 7, subject: "MATH", unitId: "g7-number-sense-pilot", title: "Place value and decimal comparison", repositoryCommit: BASE,
    sources: [source],
    objectives: [
      { id: OBJECTIVE, kind: "NATIONAL", statement: "Explain decimal place value and justify comparisons using equal place units.", sourceId: source.id, sourcePointer: "/lessons/0/packageGaps", scope: "REQUIRED", mapping: "PROPOSED" },
      { id: EXTENSION, kind: "LIBERIALEARN_EXTENSION", statement: "Investigate how place units change in a base other than ten.", sourceId: source.id, sourcePointer: "/lessons/0/packageGaps/3", scope: "OPTIONAL_EXTENSION", mapping: "PROPOSED" },
    ],
    outcomes: [{ id: "outcome-number-sense", objectiveIds: [OBJECTIVE], demonstration: "Produce an expanded decimal and justify a comparison independently, including an unfamiliar representation." }, { id: "outcome-extension", objectiveIds: [EXTENSION], demonstration: "Propose a consistent non-decimal place-value system, optionally." }],
    prerequisites: [{ id: "whole-number-place-value", statement: "A digit's place determines its value in a whole number.", diagnosticResourceId: "quiz", fallbackResourceId: "worksheet" }],
    misconceptions: [{ id: MISCONCEPTION, objectiveId: OBJECTIVE, description: "More digits after a decimal point always mean a greater number.", instructionResourceId: "lesson-2", assessmentResourceId: "quiz", responsePattern: "longer" }],
    sequence: [
      { resourceId: "quiz", dependsOn: [], objectiveIds: [OBJECTIVE], scaffold: "NONE" },
      { resourceId: "lesson-1", dependsOn: ["quiz"], objectiveIds: [OBJECTIVE], scaffold: "FULL" },
      { resourceId: "lesson-2", dependsOn: ["lesson-1"], objectiveIds: [OBJECTIVE], scaffold: "NONE" },
      { resourceId: "summative", dependsOn: ["lesson-2"], objectiveIds: [OBJECTIVE], scaffold: "NONE" },
    ],
    resources: [
      resource("curriculum-map", "DESIGN_NOTE", "CURRICULUM_ARCHITECT", [], "REVIEWER_ONLY"),
      resource("learning-design", "DESIGN_NOTE", "LEARNING_SCIENCE_DESIGNER", ["curriculum-map"], "REVIEWER_ONLY"),
      resource("lesson-1", "LESSON", "LESSON_AUTHOR", ["learning-design"]), resource("lesson-2", "LESSON", "LESSON_AUTHOR", ["lesson-1"]),
      resource("classwork", "CLASSWORK", "LESSON_AUTHOR", ["lesson-2"]), resource("homework", "HOMEWORK", "LESSON_AUTHOR", ["lesson-2"]),
      resource("worksheet", "WORKSHEET", "LESSON_AUTHOR", ["lesson-1"]), resource("teacher-guide", "TEACHER_GUIDE", "LESSON_AUTHOR", ["lesson-1", "lesson-2"], "TEACHER"),
      resource("quiz", "QUIZ", "ASSESSMENT_DESIGNER", ["lesson-1", "lesson-2"]), resource("summative", "SUMMATIVE", "ASSESSMENT_DESIGNER", ["lesson-2"]),
      resource("retention", "RETENTION", "ASSESSMENT_DESIGNER", ["summative"]), resource("transfer", "TRANSFER", "ASSESSMENT_DESIGNER", ["summative"]),
      resource("answer-keys", "ANSWER_KEY", "ASSESSMENT_DESIGNER", ["quiz", "summative", "retention", "transfer"], "REVIEWER_ONLY"),
      resource("rubrics", "RUBRIC", "ASSESSMENT_DESIGNER", ["summative", "transfer"], "REVIEWER_ONLY"),
      resource("practical", "PRACTICAL", "PROJECT_PRACTICAL_DESIGNER", ["lesson-2", "summative"]), resource("project", "PROJECT", "PROJECT_PRACTICAL_DESIGNER", ["practical", "summative"]),
      resource("accessible-text", "ACCESSIBLE_ASSET", "MEDIA_ACCESSIBILITY", ["lesson-1", "lesson-2", "practical", "project"]),
      resource("extension", "EXTENSION", "MEDIA_ACCESSIBILITY", ["project"], "LEARNER", [EXTENSION]),
    ],
    assessmentPlan: [
      task("pre-place-value", "quiz", "PREREQUISITE_DIAGNOSTIC", "PRE_LESSON", "KEYED", { prerequisiteIndex: 0, fallbackRoute: "worksheet" }),
      task("independent-practice", "classwork", "SHORT_CONSTRUCTED_RESPONSE", "IN_LESSON", "NOT_SCORED"),
      task("end-produced", "summative", "SHORT_CONSTRUCTED_RESPONSE", "END_OF_LESSON", "KEYED"),
      task("end-reasoning", "summative", "EXTENDED_REASONING", "END_OF_LESSON", "ANALYTIC_RUBRIC"),
      task("delayed", "retention", "DELAYED_RETRIEVAL", "DELAYED", "KEYED", { delayDays: 7 }),
      task("new-context", "transfer", "TRANSFER_TASK", "END_OF_LESSON", "ANALYTIC_RUBRIC", { context: "NEW" }),
      task("optional-extension", "extension", "EXTENSION", "IN_LESSON", "NOT_SCORED", { optional: true, objectiveIds: [EXTENSION] }),
    ],
    support: { differentiation: ["Offer a labelled place chart and oral rehearsal before fading supports.", "Use larger type or dictation without supplying mathematical steps.", "Offer the optional base investigation after independent core work."],
      accessibility: ["All instructions and diagrams have text equivalents.", "Keyboard and paper response paths preserve the objective.", "No task depends on colour, audio or motion."],
      offline: { mode: "TEXT_PAPER_CAPTURE_ONLY", requirements: ["Print the text worksheet and use pencil responses.", "Keep assessment keys off learner devices; sync responses for server or human scoring."], maxBytes: 200000 } },
    provenance: [source, template], legacy: [], legacyLeads: [{ identifier: "cmss8t4hz00unvo54epnfst66", reportedNamespace: "REVISION_ID_IN_PR191", subject: "MATH", reportedTitle: "Number Sense and Place Value", verification: "UNVERIFIED_REFERENCE_ONLY" }], unresolved: ["PRODUCTION_INVENTORY_NOT_VERIFIED", "MOE_OBJECTIVE_UNBOUND", "TEMPLATE_CELL_MISSING", "ONTOLOGY_RELEASE_MISSING", "SCOPE_EXTENSION_UNAPPROVED", "LEGACY_COMPARISON_SIGNOFF"],
  });
}

function document(title: string, sections: DocumentCandidate["sections"], references: string[] = []): DocumentCandidate {
  return { kind: "DOCUMENT", title, sections, textAlternative: sections.map(s => `${s.heading}: ${s.text}`).join("\n"), keyboardPath: "Read headings and paragraphs in document order; enter responses in text or on paper.", offlineInstructions: "Print or cache this text. Record work on paper. No network, sound, colour or pointer movement is required.", references };
}

function lesson(second: boolean): CandidateLessonV2 {
  const prefix = second ? "compare" : "places";
  const scene = (suffix: string, type: CandidateScene["type"], purpose: CandidateScene["purpose"], body: string, scaffold: ScaffoldLevel, prompt?: string): CandidateScene => ({
    id: `${prefix}-${suffix}`, type, title: `${prefix}: ${suffix}`, purpose, objectiveIds: [OBJECTIVE], learnerAction: prompt ?? "Read the explanation and describe the place units in your own words.", content: { body },
    interaction: prompt ? { kind: "FREE_RESPONSE", prompts: [{ id: `${prefix}-${suffix}-response`, prompt, minLength: 1 }] } : { kind: "NONE" },
    tools: { requested: [], prohibited: [] }, hints: [], misconceptionIds: purpose === "ADDRESS_MISCONCEPTION" ? [MISCONCEPTION] : [],
    evidence: prompt ? { kind: "FORMATIVE_OBSERVATION", evidenceType: "PRACTICE", responses: [{ responseKey: `${prefix}-${suffix}-response`, objectiveId: OBJECTIVE, responseType: "TEXT", scaffoldLevel: scaffold }] } : { kind: "NONE" },
    accessibility: { textAlternative: body, keyboardPath: prompt ? "Tab to the text field and type; paper or oral transcription is equivalent." : "Read the paragraph in document order.", reducedMotion: "NOT_APPLICABLE" },
    offline: { mode: "FULL_OFFLINE", note: "Use the text and a notebook; capture written responses for later sync." }, completion: prompt ? "ALL_RESPONSES_WRITTEN" : "VIEWED",
    pedagogy: { strategy: "WORKED_EXAMPLE_FADING", representation: "VERBAL", scaffoldLevel: scaffold },
  });
  return { contractVersion: "candidate-lesson-v2/1.0.0", title: second ? "Compare decimals with equal units" : "Build decimal place value", estimatedMinutes: 35, ageBand: "JUNIOR_SECONDARY",
    prerequisiteAssumptions: ["Recognize tens and ones in whole numbers."],
    misconceptions: second ? [{ id: MISCONCEPTION, objectiveId: OBJECTIVE, description: "The decimal with more digits must be larger.", response: "Express both decimals with the same place units before comparing." }] : [],
    scenes: [
      scene("intro", "INTRO", "STATE_OBJECTIVE", second ? "We will compare decimals and justify which has greater value without counting digits." : "We will explain how the value of a digit changes with its place, including places smaller than one.", "FULL"),
      scene("model", "GUIDED_EXAMPLE", "MODEL_WORKED_EXAMPLE", second ? "Compare 0.6 and 0.48. Six tenths is sixty hundredths. Sixty hundredths is greater than forty-eight hundredths, so 0.6 is greater." : "In 32.45, 3 represents thirty, 2 represents two, 4 represents four tenths and 5 represents five hundredths. Each place to the right has one tenth the value of the previous place.", "FULL"),
      scene("guided", "PRACTICE", "GUIDED_PRACTICE", second ? "Rewrite 0.7 as hundredths. Now compare it with 0.65. Explain the common unit you chose." : "For 24.36, label tens, ones, tenths and hundredths. Then describe the value represented by 3.", "PARTIAL", second ? "Compare 0.7 and 0.65 using hundredths." : "Explain the value of 3 in 24.36 using the place labels."),
      ...(second ? [scene("misconception", "EXPLANATION", "ADDRESS_MISCONCEPTION", "Counting decimal digits does not compare their value. For 0.5 and 0.42, think fifty hundredths and forty-two hundredths. Adding a trailing zero changes notation but not quantity.", "MINIMAL")] : []),
      scene("independent", "PRACTICE", "INDEPENDENT_PRACTICE", second ? "Work alone without a place chart, tutor or worked example. Explain the units used in your comparison." : "Work alone. Write the number as a sum of its place values and explain what each digit represents.", "NONE", second ? "Which is greater, 0.8 or 0.76? Justify using equal units." : "Write 41.27 as a sum of place values and explain the value of 2."),
      scene("reflect", "REFLECTION", "REFLECT", "Describe a mistake you can now avoid. This reflection is practice and does not establish mastery.", "NONE", "What will you check when comparing decimal quantities?"),
    ], assessmentRequests: [], labProposals: [] };
}

function activity(id: string, kind: ActivityDefinitionV1["kind"], title: string, steps: string[], independent = true): ActivityDefinitionV1 {
  const a: ActivityDefinitionV1 = { schemaVersion: "activity-definition.v1", activityId: id, version: "0.1.0", kind, contentHash: "",
    content: { title, objectiveIds: [OBJECTIVE], lessonItemIds: ["lesson-2"], scaffolding: independent ? "INDEPENDENT" : "GUIDED",
      instructions: { learner: steps.map((text, i) => ({ stepId: `${id}-step-${i + 1}`, text, resourceIds: [] })), teacher: [{ stepId: `${id}-teacher`, text: "Record assistance separately. Ask for reasoning before feedback. Use the protected assessment rubric only for independently collected assessment responses.", resourceIds: [] }] },
      resourceIds: [], rubric: null, expectedDurationMinutes: 20, collaborationMode: "INDIVIDUAL", evidenceIntent: { kind: "PRACTICE_ONLY", forms: ["WRITTEN"] },
      accessibility: { readingLevel: "Grade 7, vocabulary support permitted", supportsScreenReader: true, supportsReadAloud: true, requiresColorVision: false, requiresFineMotor: false, alternativeFormatResourceIds: [] } },
    resources: [], lessonBindings: [{ lessonId: "lesson-2", version: "0.1.0" }], release: candidateRelease,
    governance: { provenanceRefs: ["unit-blueprint:factory-g7-number-sense@0.1.0"], reviewRefs: [], lifecycleRefs: [], releaseRefs: [] } };
  return { ...a, contentHash: hashActivityDefinition(a) };
}

function assessment(id: string, purpose: AssessmentPurpose, prompts: { prompt: string; key: ScoringKey; explanation: string; misconception?: boolean }[]): AssessmentCandidate {
  const provenance = { authors: [{ kind: "AI" as const, id: "factory-demo:ASSESSMENT_DESIGNER" }], sourceRef: "unit-blueprint:factory-g7-number-sense@0.1.0", curriculumSourceRefs: ["PROPOSED_G7_MAPPING_NOT_APPROVED"] };
  const definition = sealDefinition({ schemaVersion: "assessment.v2", definitionId: id, version: "0.1.0", title: `Grade 7 ${id} candidate`, purpose, grade: 7, subject: "MATH", objectiveIds: [OBJECTIVE], prerequisiteObjectiveIds: [],
    alignment: { ...candidateRelease, nationalObjectiveIds: [OBJECTIVE], extensionObjectiveIds: [] }, timeLimitMinutes: 20,
    permittedTools: [{ toolId: "ai-tutor", mode: "PROHIBITED" }], permittedAccommodations: ["READ_ALOUD", "LARGE_PRINT"], attemptPolicy: { maxAttempts: 1, cooldownMinutes: 0, reportedAttempt: "FIRST" }, provenance });
  const specs: ProtectedScoringSpec[] = prompts.map((p, index) => ({ schemaVersion: "assessment.v2", itemId: `${id}-item-${index + 1}`, itemVersion: "0.1.0", scoringVersion: "0.1.0", maxPoints: p.key.kind === "RUBRIC" ? 4 : 1, key: p.key, explanation: p.explanation,
    misconceptionSignals: p.misconception ? [{ responsePattern: "longer", misconceptionId: MISCONCEPTION }] : [], moderationNotes: ["REVIEWER ONLY. Independently verify this candidate key; AI output has no scoring authority."] }));
  const items = prompts.map((p, index) => sealItem({ schemaVersion: "assessment.v2", itemId: specs[index].itemId, version: "0.1.0", itemType: p.key.kind === "SINGLE_SELECT" ? "SINGLE_SELECT" : p.key.kind === "RUBRIC" ? "WORKED_SOLUTION" : "NUMERIC",
    stimulus: { prompt: p.prompt, context: null, resourceIds: [], options: p.key.kind === "SINGLE_SELECT" ? [{ optionId: "equal-units", text: "0.9 is greater" }, { optionId: "longer", text: "0.81 is greater" }, { optionId: "equal", text: "They are equal" }] : [], orderingElements: [], matchingLeft: [], matchingRight: [], expectedUnit: null, learnerVisibleCriteria: p.key.kind === "RUBRIC" ? ["State a comparison and justify it with equal place units.", "Explain why decimal digit count can mislead."] : [] },
    objectiveIds: [OBJECTIVE], misconceptionIds: p.misconception ? [MISCONCEPTION] : [], difficulty: 2, cognitiveDemand: p.key.kind === "RUBRIC" ? "ANALYZE" : "APPLY", context: purpose === "TRANSFER" ? "NEW" : "REHEARSED", hints: [], feedbackPolicy: { hints: "NONE", explanation: "NEVER", correctAnswer: "NEVER" }, provenance }, specs[index]));
  const form = sealForm({ schemaVersion: "assessment.v2", formId: `${id}-form`, version: "0.1.0", definition: { definitionId: definition.definitionId, version: definition.version, contentHash: definition.contentHash },
    items: items.map((item, i) => ({ itemId: item.itemId, itemVersion: item.version, itemHash: item.itemHash, points: specs[i].maxPoints })),
    delivery: { itemOrder: "FIXED", randomizationPolicyId: null, allowBacktracking: true, offlineDelivery: "CAPTURE_ONLY" },
    blueprint: { blueprintVersion: "0.1.0", totalPoints: specs.reduce((n, s) => n + s.maxPoints, 0), objectiveCoverage: [{ objectiveId: OBJECTIVE, minItems: 1 }] } });
  return { kind: "ASSESSMENT", definition, form, items, specs };
}

const numeric = (value: number): ScoringKey => ({ kind: "NUMERIC", key: { value, absoluteTolerance: 0, acceptedUnits: [], wrongUnitCredit: 0 } });
const reasoningRubric = (): ScoringKey => ({ kind: "RUBRIC", rubric: { rubricId: "decimal-reasoning", rubricVersion: "0.1.0", criteria: [
  { criterionId: "units", title: "Common units", levels: [{ points: 0, descriptor: "No meaningful unit conversion is supplied." }, { points: 1, descriptor: "A useful unit is named but conversion is incomplete." }, { points: 2, descriptor: "Both quantities are correctly expressed in a common unit." }] },
  { criterionId: "justification", title: "Reasoned comparison", levels: [{ points: 0, descriptor: "No defensible comparison is provided." }, { points: 1, descriptor: "The comparison is correct with incomplete reasoning." }, { points: 2, descriptor: "The comparison follows from equal-unit reasoning and explains why counting digits fails." }] },
] } });

export function demoExecutors(): FactoryExecutors {
  const draft = (id: string, payload: ResourceDraft["payload"]): ResourceDraft => ({ id, version: "0.1.0", payload });
  return {
    CURRICULUM_ARCHITECT: async () => [draft("curriculum-map", document("Source and scope decisions", [{ heading: "National mapping pending", text: "The existing Grade 7 source report records MOE_OBJECTIVE_UNBOUND. Decimal place value is proposed for review, with no curriculum release or MOE approval claimed." }, { heading: "Extension", text: "Base generalisation is an optional LiberiaLearn extension and cannot gate required progress." }]))],
    LEARNING_SCIENCE_DESIGNER: async () => [draft("learning-design", document("Progression and evidence", [{ heading: "Sequence", text: "Diagnose whole-number place value; reteach using a chart if needed. Model decimal places, guide responses, then require independent production. Compare decimals using equal units, teach against digit-count errors, then withhold assistance during end checks." }, { heading: "Delayed and new contexts", text: "Propose a delayed check after at least seven days, subject to an approved grade/subject policy. Use an unfamiliar measurement table for transfer. Neither opportunity is learning evidence until independently completed and verified." }], ["curriculum-map"]))],
    LESSON_AUTHOR: async () => [
      draft("lesson-1", { kind: "LESSON", candidate: lesson(false) }), draft("lesson-2", { kind: "LESSON", candidate: lesson(true) }),
      draft("classwork", { kind: "ACTIVITY", definition: activity("classwork", "CLASSWORK", "Independent decimal production", ["Write 53.24 as a sum of place values. Explain what the digit 2 represents.", "Compare 0.4 and 0.37. Explain using the same fractional unit.", "Check your explanation without using a worked example. Record any help you used."]) }),
      draft("homework", { kind: "ACTIVITY", definition: activity("homework", "HOMEWORK", "Practise decimal explanations", ["Write 26.53 as tens, ones, tenths and hundredths.", "Compare 0.3 with 0.28 and justify your decision.", "Write a pair of decimals where the longer written decimal is smaller. Ask someone to listen to your reasoning without giving the answer."]) }),
      draft("worksheet", document("Place chart and practice sheet", [{ heading: "Prerequisite fallback", text: "Draw columns labelled tens and ones. Put 4 in tens and 2 in ones. Explain how 42 differs from 24. If unsure, make four groups of ten marks and two single marks. Repeat with 31, then remove the drawing." }, { heading: "Faded decimal support", text: "Add tenths and hundredths columns. Place 3.25 in the chart. State each digit's value. Cover the labels and explain 7.46. Finally work without the chart: compare 0.2 and 0.19 using equal place units." }], ["lesson-1"])),
      draft("teacher-guide", document("Teacher guide", [{ heading: "Before instruction", text: "Administer the quiz as a diagnostic without feedback. Route tens/ones errors to the worksheet. Keep this separate from the end-of-unit measure. All numerical contexts in this package are invented classroom examples, not reported local measurements or prices." }, { heading: "Differentiation and independence", text: "Offer oral directions, large print and a place chart during instruction. Fade the chart before the independent stage. A scribe may transcribe without supplying steps. Record tutoring, hints and collaboration as assistance. Do not count assisted work as independent evidence." }, { heading: "Assessment and follow-up", text: "Use the withheld summative form after instruction. Score reasoning through authorized human moderation using the protected rubric. Plan delayed retrieval only after policy approval. Revisit the misconception scene when learners compare by digit count." }], ["lesson-1", "lesson-2"]))],
    ASSESSMENT_DESIGNER: async () => [
      draft("quiz", assessment("quiz", "DIAGNOSTIC", [{ prompt: "What value does the digit 4 represent in 42?", key: numeric(40), explanation: "The digit 4 is in the tens place, representing four tens or forty." }, { prompt: "Compare 0.9 and 0.81. Select the greater quantity.", key: { kind: "SINGLE_SELECT", correctOptionId: "equal-units" }, explanation: "Nine tenths is ninety hundredths, which exceeds eighty-one hundredths.", misconception: true }])),
      draft("summative", assessment("summative", "SUMMATIVE", [{ prompt: "What value does the digit 7 represent in 26.73? Write a decimal number.", key: numeric(0.7), explanation: "Seven tenths has decimal value 0.7 in the number 26.73." }, { prompt: "Compare 0.45 and 0.5. Justify using a common unit and explain why counting decimal digits fails.", key: reasoningRubric(), explanation: "Five tenths equals fifty hundredths; this is greater than forty-five hundredths, so 0.5 exceeds 0.45." }])),
      draft("retention", assessment("retention", "RETENTION", [{ prompt: "Without a worked example, give the decimal value of the digit 6 in 18.64.", key: numeric(0.6), explanation: "The 6 occupies the tenths column, so its value is six tenths, written 0.6." }])),
      draft("transfer", assessment("transfer", "TRANSFER", [{ prompt: "An invented measurement table lists seedlings A: 0.62 m, B: 0.7 m. A learner claims A is taller because 62 exceeds 7. Evaluate the claim using equal units. This table was not used during instruction.", key: reasoningRubric(), explanation: "Seven tenths of a metre is seventy hundredths, exceeding sixty-two hundredths; seedling B is taller." }])),
      draft("answer-keys", document("Protected answer-key index", [{ heading: "Authorized reviewer use only", text: "Keys are stored once in each Assessment V2 ProtectedScoringSpec, identified by itemId, itemVersion, scoringVersion and the item's scoringSpecHash. Verify the form's exact item hashes. Do not copy the specs into a learner document or offline package." }], ["quiz", "summative", "retention", "transfer"])),
      draft("rubrics", document("Protected rubric index", [{ heading: "Analytic scoring", text: "The summative and transfer ProtectedScoringSpec records contain the exact decimal-reasoning rubric version and descriptors. Learners receive criteria only. An authorized human scores constructed reasoning; an AI recommendation cannot supply an official score." }], ["summative", "transfer"])),
    ],
    PROJECT_PRACTICAL_DESIGNER: async () => [
      draft("practical", { kind: "ACTIVITY", definition: activity("practical", "PRACTICAL", "Paper decimal strips", ["Draw two equal-length strips divided into ten equal sections. Mark quantities 0.4 and 0.35, subdividing sections into hundredths when needed.", "Label the units in text; do not rely on colour. Explain which marked length is greater.", "If drawing is difficult, dictate a table of tenths and hundredths instead. Record a written justification. This is practice, not a certified lab."], false) }),
      draft("project", { kind: "ACTIVITY", definition: activity("project", "PROJECT", "Create a decimal misconception guide", ["Create a one-page guide showing two invented decimal comparisons where digit count gives the wrong answer.", "For each comparison, show equal-unit reasoning. Include an original place-value diagram or a text table.", "Exchange guides for comments, then submit your own revision with the help you received recorded. Practice feedback does not establish independent mastery."]) }),
    ],
    MEDIA_ACCESSIBILITY: async () => [
      draft("accessible-text", document("Text alternatives", [{ heading: "Place chart in reading order", text: "Column one: tens. Column two: ones. Column three: tenths. Column four: hundredths. Read each digit with its column label. A blank place represents zero units of that size." }, { heading: "Practical alternative", text: "Instead of drawing shaded strips, make two text rows. Row one: four tenths equals forty hundredths. Row two: thirty-five hundredths. Compare their quantities verbally, then write your reason. The response can be typed, dictated or handwritten." }], ["lesson-1", "lesson-2", "practical", "project"])),
      draft("extension", document("Optional base investigation", [{ heading: "Non-gating extension", text: "Imagine a counting system in which each place to the left is worth five times its neighbour. Invent notation for six objects and eleven objects, and explain your rules. Compare the grouping with our decimal system. This is a proposed LiberiaLearn extension, optional, and never required for core progression." }], ["project"])),
    ],
    // Local demonstration executors do not pretend to have performed an independent expert review.
    INDEPENDENT_QUALITY_REVIEWER: async () => [], GOVERNANCE_RELEASE: async () => [],
  };
}

/** Compose existing ContentBundle V1 references, with no release or review attestations. */
export function candidateBundle(blueprint: UnitBlueprint, artifacts: readonly FactoryArtifact[]): ContentBundleV1 {
  const lessons = artifacts.flatMap(a => a.payload.kind === "LESSON" ? [{ identity: { itemId: a.id, itemVersion: a.version, itemKind: "LESSON" as const }, title: a.payload.candidate.title, objectiveIds: [...new Set(a.payload.candidate.scenes.flatMap(s => s.objectiveIds))], estimatedMinutes: a.payload.candidate.estimatedMinutes, resourceIds: [] }] : []);
  const activities = artifacts.flatMap(a => a.payload.kind === "ACTIVITY" ? [{ activityId: a.id, version: a.version, kind: a.payload.definition.kind }] : []);
  const assessments = artifacts.flatMap(a => a.payload.kind === "ASSESSMENT" ? [{ identity: { itemId: a.id, itemVersion: a.version, itemKind: a.id === "quiz" ? "QUIZ" as const : "ASSESSMENT" as const }, role: a.id === "quiz" ? "QUIZ" as const : "UNIT_ASSESSMENT" as const, title: a.payload.definition.title, objectiveIds: a.payload.definition.objectiveIds, definition: { definitionId: a.payload.definition.definitionId, definitionVersion: a.payload.definition.version }, items: a.payload.items.map(i => ({ assessmentItemId: i.itemId, assessmentItemVersion: i.version })), itemOrder: { kind: "FIXED" as const }, learnerInstructions: ["Candidate preview only. Independent assessment requires a separately authorized release."], secured: { answerKeyResourceId: "answer-keys", scoringGuideResourceId: "rubrics" } }] : []);
  const bundle: ContentBundleV1 = { schemaVersion: "content-bundle.v1", identity: { bundleId: blueprint.unitId, version: blueprint.version, title: blueprint.title, gradeLevel: blueprint.grade, subject: blueprint.subject, locale: "en-LR", contentHash: null },
    curriculumAuthority: { ...candidateRelease, objectiveIds: blueprint.objectives.map(o => o.id), standardIds: [], sourceVersionRefs: blueprint.sources.map(s => `${s.id}@${s.version}#${s.sha256}`), conceptRefs: [], constructBindingRefs: [] },
    sequence: { units: [{ unitId: blueprint.unitId, unitVersion: blueprint.version, title: blueprint.title, order: 1, prerequisiteUnitIds: [], entries: blueprint.sequence.map((s, index) => ({ itemId: s.resourceId, order: index + 1, requirement: "REQUIRED", prerequisiteItemIds: s.dependsOn, unlocksItemIds: [] })) }] },
    lessons, activities: [], activityReferences: activities, assessments, labs: [],
    resources: artifacts.flatMap(a => a.payload.kind === "DOCUMENT" ? [{ resourceId: a.id, resourceVersion: a.version, kind: blueprint.resources.find(r => r.id === a.id)?.kind === "ANSWER_KEY" ? "ANSWER_KEY" as const : "DOCUMENT" as const, audience: blueprint.resources.find(r => r.id === a.id)?.audience === "LEARNER" ? "LEARNER" as const : "TEACHER" as const, title: a.payload.title, locale: "en-LR", assetId: null }] : []),
    toolkitBindings: [], toolkitMapping: null, learnerSupport: { remediation: [{ supportId: "place-chart-fallback", objectiveIds: [OBJECTIVE], itemIds: ["lesson-1"], resourceIds: ["worksheet", "accessible-text"] }], enrichment: [{ supportId: "optional-base-investigation", objectiveIds: [EXTENSION], itemIds: [], resourceIds: ["extension"] }], accommodations: [], languageVariants: [] },
    renderings: [], offline: { packageable: false, assets: [], allowedCapabilities: [], reconnectSemantics: { requiredFor: ["SUBMISSION_SYNC", "SUMMATIVE_ASSESSMENT", "EVIDENCE_RECONCILIATION"], maxOfflineDays: null } },
    governance: { provenanceRefs: [`unit-blueprint:${blueprint.blueprintId}@${blueprint.version}#${blueprint.contentHash}`], reviewRefs: [], lifecycleRefs: [], releaseRefs: [] },
    extensions: { unitBlueprint: { blueprintId: blueprint.blueprintId, version: blueprint.version, contentHash: blueprint.contentHash }, candidateOnly: true } };
  return { ...bundle, identity: { ...bundle.identity, contentHash: hashContentBundle(bundle) } };
}

export async function buildDemo() {
  return runFactory({ blueprint: demoBlueprint(), executors: demoExecutors(), appendAudit: async () => {} });
}
