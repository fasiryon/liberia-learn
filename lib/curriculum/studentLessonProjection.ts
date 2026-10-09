import { CURRICULUM_V2_PAYLOAD_KEY, isNativeCurriculumV2Payload, type CurriculumLessonV2 } from "@/lib/curriculum/v2/contract";
import { toLessonExperience } from "@/lib/curriculum/v2/compat";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { assertNoLearnerSecretKeys, rebuildLearnerExperience } from "@/lib/learner-experience/learnerSafeExperience";
type StudentMaterials = {
  learnerMaterial?: unknown;
  guidedItems?: unknown;
  independentItems?: unknown;
  masteryTask?: unknown;
  classwork?: unknown;
  groupWork?: unknown;
  homework?: unknown;
  project?: unknown;
  lab?: unknown;
};

type LessonPayloadRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Learner-visible scalars: a primitive of the expected type, never an object that could carry a key. */
function scalarText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function scalarGrade(value: unknown): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return typeof value === "string" ? value : undefined;
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

/*
 * Learner payloads are built by explicit allow-lists (Curriculum V2 / Codex P1-2): only named,
 * type-checked fields reach a student. Unknown fields — including future ones — never flow
 * through, so answer, answerKey, correctIndex, explanation, scoring, rubric and teacher-only
 * material stay on the server even when they are nested or renamed.
 */
type Picked = Record<string, unknown>;

function pickStrings(source: LessonPayloadRecord, keys: readonly string[]): Picked {
  const out: Picked = {};
  for (const key of keys) if (typeof source[key] === "string") out[key] = source[key];
  return out;
}

function pickNumbers(source: LessonPayloadRecord, keys: readonly string[]): Picked {
  const out: Picked = {};
  for (const key of keys) if (typeof source[key] === "number" && Number.isFinite(source[key])) out[key] = source[key];
  return out;
}

function pickBooleans(source: LessonPayloadRecord, keys: readonly string[]): Picked {
  const out: Picked = {};
  for (const key of keys) if (typeof source[key] === "boolean") out[key] = source[key];
  return out;
}

function record(value: unknown): LessonPayloadRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as LessonPayloadRecord) : null;
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : undefined;
}

/** Choice options: plain strings, or objects reduced to their visible id/label/text (never a correctness flag). */
function safeOptions(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((option): unknown[] => {
    if (typeof option === "string") return [option];
    const source = record(option);
    if (!source) return [];
    const picked = pickStrings(source, ["id", "label", "text"]);
    return Object.keys(picked).length ? [picked] : [];
  });
}

/** Assessment/quiz item visible to a learner: the question and its choices only. */
export function projectStudentAssessmentItem(item: unknown): Picked | null {
  const source = record(item);
  if (!source) return null;
  const out: Picked = {
    ...pickStrings(source, ["id", "question", "prompt", "type", "standardCode", "difficulty"]),
    ...pickNumbers(source, ["points"]),
  };
  const options = safeOptions(source.options);
  const choices = safeOptions(source.choices);
  if (options) out.options = options;
  if (choices) out.choices = choices;
  return typeof out.question === "string" || typeof out.prompt === "string" ? out : null;
}

function safeAssessment(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(projectStudentAssessmentItem).filter((item): item is Picked => item !== null);
}

function numbered(values: string[]): string {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

const LEGACY_TEACHER_ONLY_HEADINGS = new Set([
  "answer guide",
  "assessment alignment",
  "evidence record",
  "extension branch",
  "lesson study notes",
  "metadata",
  "remediation branch",
  "teacher checkpoints",
  "teacher explanation",
  "teacher guidance",
  "teacher notes",
  "teacher planning record",
  "teacher talk",
]);

/**
 * Legacy lessons predate studentMaterials and often mix learner content with
 * teacher planning sections. Keep the usable learner sections while removing
 * known teacher-only or answer-bearing sections.
 */
/**
 * Answer- or teacher-bearing section titles, matched at any heading level. A heading that IS an
 * answer label ("Answers", "Solution:", "3. Expected Response") or names answer/teacher material
 * ("Answer Key", "Model answers", "Mark Scheme", "Teacher notes") opens an excluded section. A
 * learner heading that merely uses the word ("Answer the questions below", "Solutions to pollution")
 * is kept, and ordinary prose is never matched — only heading and answer-label lines.
 */
const ANSWER_LABEL = String.raw`(?:(?:expected|model|sample|suggested|correct|possible|teachers?'?)\s+)?(?:answers?|responses?|solutions?|worked\s+solutions?|answer\s+key|answer\s+guide|mark(?:ing)?\s+schemes?|marking\s+guide)(?:\s+(?:key|guide|and\s+explanations?|with\s+explanations?))?`;
const ANSWER_HEADING = new RegExp(String.raw`^${ANSWER_LABEL}$`, "i");
const TEACHER_OR_ANSWER_HEADING = /\b(answer key|answer guide|answers to|expected (answers?|responses?)|model answers?|sample answers?|suggested answers?|worked solutions?|mark(ing)? schemes?|marking guide|rubric|scoring|teacher|facilitator)\b/i;
/** A line that starts with an answer label and a colon ("**Expected Response:** 3/4", "Answer: 6"). */
const ANSWER_LABEL_LINE = new RegExp(String.raw`^\s*(?:[-*]\s+)?(?:\*\*|__)?\s*${ANSWER_LABEL}\s*(?:\*\*|__)?\s*:\s*(?:\*\*|__)?`, "i");

function normalizeHeading(heading: string): string {
  return heading
    .replace(/[*_`]/g, "")
    .replace(/^(?:(?:part|step|section|question)\s+)?(?:\d+|[ivx]+)[.):-]?\s+/i, "")
    .replace(/[\s:.!?-]+$/g, "")
    .trim()
    .toLowerCase();
}

function isExcludedHeading(heading: string): boolean {
  const normalized = normalizeHeading(heading);
  return LEGACY_TEACHER_ONLY_HEADINGS.has(normalized) || ANSWER_HEADING.test(normalized) || TEACHER_OR_ANSWER_HEADING.test(normalized);
}

function projectLegacyBody(value: unknown): string {
  const body = text(value);
  if (!body) return "";

  const lines = body.split(/\r?\n/);
  // Excluded section: skipped until a heading at the same or a higher level.
  let excludedLevel: number | null = null;
  // An answer label alone on its line ("**Expected Response:**") hides the block below it.
  let inAnswerBlock = false;
  const kept: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match) {
      inAnswerBlock = false;
      const level = match[1].length;
      if (excludedLevel !== null && level <= excludedLevel) excludedLevel = null;
      if (excludedLevel === null && isExcludedHeading(match[2])) excludedLevel = level;
    }
    if (excludedLevel !== null) continue;
    if (inAnswerBlock) {
      if (!line.trim()) inAnswerBlock = false;
      continue;
    }
    if (!match && ANSWER_LABEL_LINE.test(line)) {
      if (!line.replace(ANSWER_LABEL_LINE, "").trim()) inAnswerBlock = true;
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function safeProblemSets(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as LessonPayloadRecord;
    const { id, sectionId, label, studentPrompt, workingSpace } = source;
    if (typeof studentPrompt !== "string" || !studentPrompt.trim()) return [];
    return [{
      id: typeof id === "string" || typeof id === "number" ? id : undefined,
      sectionId: typeof sectionId === "string" ? sectionId : undefined,
      label: typeof label === "string" ? label : null,
      studentPrompt: studentPrompt.trim(),
      workingSpace: typeof workingSpace === "string" ? workingSpace : null,
    }];
  });
}

function approvedOnly(value: unknown): LessonPayloadRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = record(item);
    return source && source.approved === true && source.renderStatus === "ready" ? [source] : [];
  });
}

/**
 * Pseudo-lab fields the learner lesson renders (no confusion signals, success rates or teacher guides).
 * `expectedObservation` and a simulation's `explanation`/`guardianGuide` are deliberately learner-visible
 * in these legacy artifacts: the lesson UI presents them as "what you should see" and "how it works"
 * after the activity. They are not assessment keys (assessment `explanation` is never projected). Native
 * Curriculum V2 keeps expected observations reviewer-only.
 */
function safePseudoLabs(value: unknown): unknown[] {
  return approvedOnly(value).map((lab) => ({
    ...pickStrings(lab, ["id", "title", "objective", "labType", "difficulty", "resourceLevel", "safetyNotes", "expectedObservation", "fallbackMode", "fallbackIfNoMaterials", "guardianHomeVariant", "simulationType", "renderStatus"]),
    ...pickNumbers(lab, ["gradeLevel", "setupTimeMinutes", "runTimeMinutes", "cleanupTimeMinutes"]),
    ...pickBooleans(lab, ["offlineCapable", "approved"]),
    ...(stringList(lab.requiredMaterials) ? { requiredMaterials: stringList(lab.requiredMaterials) } : {}),
    ...(stringList(lab.optionalMaterials) ? { optionalMaterials: stringList(lab.optionalMaterials) } : {}),
    ...(stringList(lab.setupInstructions) ? { setupInstructions: stringList(lab.setupInstructions) } : {}),
    ...(stringList(lab.procedureSteps) ? { procedureSteps: stringList(lab.procedureSteps) } : {}),
    ...(stringList(lab.reflectionQuestions) ? { reflectionQuestions: stringList(lab.reflectionQuestions) } : {}),
  }));
}

/** Simulation fields the learner renderer uses; inputs and outputs are themselves allow-listed. */
function safeSimulations(value: unknown): unknown[] {
  return approvedOnly(value).map((definition) => ({
    ...pickStrings(definition, ["id", "title", "objective", "simulationType", "rendererKey", "fallbackRendererKey", "interactionModel", "explanation", "guardianGuide", "fallbackStaticVisual", "renderStatus"]),
    ...pickNumbers(definition, ["gradeLevel"]),
    ...pickBooleans(definition, ["approved"]),
    inputs: (Array.isArray(definition.inputs) ? definition.inputs : []).flatMap((input) => {
      const source = record(input);
      if (!source) return [];
      const defaultValue = source.defaultValue;
      return [{
        ...pickStrings(source, ["key", "label", "type"]),
        ...pickNumbers(source, ["min", "max", "step"]),
        ...(stringList(source.options) ? { options: stringList(source.options) } : {}),
        ...(typeof defaultValue === "string" || typeof defaultValue === "number" || typeof defaultValue === "boolean" ? { defaultValue }
          : stringList(defaultValue) ? { defaultValue: stringList(defaultValue) } : {}),
      }];
    }),
    outputs: (Array.isArray(definition.outputs) ? definition.outputs : []).flatMap((output) => {
      const source = record(output);
      return source ? [pickStrings(source, ["key", "label", "description"])] : [];
    }),
  }));
}

function safeLabs(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const lab = item as LessonPayloadRecord;
    const procedure = Array.isArray(lab.procedure)
      ? lab.procedure.flatMap((step) => {
          const source = record(step);
          return source ? [{ ...pickStrings(source, ["id", "title", "instruction", "safetyNote"]), ...pickNumbers(source, ["step", "stepNumber", "durationMinutes"]) }] : [];
        })
      : [];
    const observationForm = Array.isArray(lab.observationForm)
      ? lab.observationForm.flatMap((field) => {
          const source = record(field);
          // The lab runtime keys answers by `field` and renders `inputType`/`choices` (LabSessionClient).
          return source ? [{ ...pickStrings(source, ["id", "field", "label", "prompt", "type", "inputType", "unit"]), ...(stringList(source.choices) ? { choices: stringList(source.choices) } : {}) }] : [];
        })
      : [];
    const analysisQuestions = Array.isArray(lab.analysisQuestions)
      ? lab.analysisQuestions.flatMap((question) => {
          const projected = projectStudentAssessmentItem(question);
          return projected ? [projected] : [];
        })
      : [];
    // Top-level lab fields are type-checked too: a nested object never rides along under a known key.
    return [{
      ...pickStrings(lab, ["id", "title", "type", "subject", "labObjective", "safetyNotes", "connectionToLesson", "virtualAlternative"]),
      ...pickNumbers(lab, ["durationMinutes", "gradeLevel"]),
      ...pickBooleans(lab, ["offlineCapable"]),
      ...(stringList(lab.materialsNeeded) ? { materialsNeeded: stringList(lab.materialsNeeded) } : {}),
      procedure,
      observationForm,
      analysisQuestions,
    }];
  });
}

function labForLearner(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const lab = value as Record<string, unknown>;
  const procedure = Array.isArray(lab.procedure)
    ? lab.procedure
        .filter((step): step is Record<string, unknown> => Boolean(step && typeof step === "object" && !Array.isArray(step)))
        .map((step) => text(step.instruction))
        .filter(Boolean)
    : [];
  const observations = Array.isArray(lab.observationForm)
    ? lab.observationForm
        .filter((field): field is Record<string, unknown> => Boolean(field && typeof field === "object" && !Array.isArray(field)))
        .map((field) => text(field.prompt))
        .filter(Boolean)
    : [];
  const questions = Array.isArray(lab.analysisQuestions)
    ? lab.analysisQuestions
        .filter((question): question is Record<string, unknown> => Boolean(question && typeof question === "object" && !Array.isArray(question)))
        .map((question) => text(question.question))
        .filter(Boolean)
    : [];
  const sections = [
    text(lab.title),
    text(lab.labObjective),
    Array.isArray(lab.materialsNeeded) && lab.materialsNeeded.length
      ? `Materials: ${lab.materialsNeeded.map(text).filter(Boolean).join(", ")}`
      : "",
    procedure.length ? `Procedure:\n${numbered(procedure)}` : "",
    observations.length ? `Record your observations:\n${numbered(observations)}` : "",
    questions.length ? `Analysis questions:\n${numbered(questions)}` : "",
    text(lab.safetyNotes) ? `Safety: ${text(lab.safetyNotes)}` : "",
    text(lab.virtualAlternative) ? `If materials are unavailable: ${text(lab.virtualAlternative)}` : "",
  ].filter(Boolean);
  return sections.join("\n\n");
}

/**
 * Build the learner-safe projection for a curriculum payload.
 *
 * NR-13 stores a rich teacher plan beside learner materials. Student routes
 * must never return the teacher plan, answer guide, worked solution, authority
 * audit details, or raw assessment keys. This projection is intentionally
 * allow-listed and keeps legacy payloads compatible until they are replaced.
 */
export function projectStudentLessonPayload(payload: unknown): LessonPayloadRecord {
  const projected = projectAllowListed(payload);
  // Defence in depth: whatever the allow-lists produced, no secret-named key leaves the server.
  try {
    assertNoLearnerSecretKeys(projected);
    return projected;
  } catch {
    return { title: scalarText(projected.title), body: "", body_standard: "", body_block: "", objectives: [], studentReady: false };
  }
}

function projectAllowListed(payload: unknown): LessonPayloadRecord {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const source = payload as LessonPayloadRecord;
  // Native Curriculum V2: learners receive only the Lesson Player V2 experience built field by field
  // (no expected observations, misconception notes, provenance, governance or review gaps). A
  // malformed native payload fails closed rather than falling back to legacy fields.
  if (isNativeCurriculumV2Payload(source)) return projectNativeLesson(source);
  const materials = source.studentMaterials as StudentMaterials | undefined;
  const hasAuthoredMaterials = Boolean(materials && typeof materials === "object" && text(materials.learnerMaterial));

  if (!hasAuthoredMaterials) {
    const legacyBody = projectLegacyBody(source.body_standard) || projectLegacyBody(source.body) || projectLegacyBody(source.lessons) || projectLegacyBody(source.content);
    if (!legacyBody) {
      return {
        title: scalarText(source.title),
        grade: scalarGrade(source.grade),
        subject: scalarText(source.subject),
        lessonFormat: scalarText(source.lessonFormat),
        objectives: [],
        activities: [],
        body: "",
        body_standard: "",
        body_block: "",
        studentReady: false,
      };
    }
    const legacyAssessment = safeAssessment(source.assessment);
    return {
      title: scalarText(source.title),
      grade: scalarGrade(source.grade),
      subject: scalarText(source.subject),
      lessonFormat: scalarText(source.lessonFormat),
      objectives: list(source.objectives),
      activities: list(source.activities),
      body: legacyBody,
      body_standard: legacyBody,
      body_block: projectLegacyBody(source.body_block) || legacyBody,
      assessment: legacyAssessment,
      moeAlignments: list(source.moeAlignments),
      labs: safeLabs(source.labs),
      pseudoLabs: safePseudoLabs(source.pseudoLabs),
      simulationDefinitions: safeSimulations(source.simulationDefinitions),
      takeawaySummary: text(source.takeawaySummary),
      durationMins: typeof source.durationMins === "number" ? source.durationMins : undefined,
      problemSets: safeProblemSets(source.problemSets),
      studentReady: true,
    };
  }

  const guided = list(materials?.guidedItems);
  const independent = list(materials?.independentItems);
  const classwork = list(materials?.classwork);
  const authoredGroupWork = text(materials?.groupWork);
  const homework = list(materials?.homework);
  const project = text(materials?.project);
  const lab = labForLearner(materials?.lab);
  const labs = safeLabs(
    Array.isArray(source.labs)
      ? source.labs
      : materials?.lab
        ? [materials.lab]
        : [],
  );
  const groupWork = authoredGroupWork || (guided.length
    ? `Discuss the material with your group. Take turns explaining which words or details support each answer. Then complete your own response.\n\n${numbered(guided)}`
    : "Discuss the material with your group, explain your evidence, and complete your own response afterward.");
  const sections = [
    text(materials?.learnerMaterial),
    guided.length ? `## Try It Together\n${numbered(guided)}` : "",
    classwork.length ? `## Classwork\n${numbered(classwork)}` : "",
    `## Group Work and Discussion\n${groupWork}`,
    independent.length ? `## Your Independent Work\n${numbered(independent)}` : "",
    text(materials?.masteryTask) ? `## Show What You Know\n${text(materials?.masteryTask)}` : "",
    homework.length ? `## Homework\n${numbered(homework)}` : "",
    project ? `## Project\n${project}` : "",
    lab ? `## Investigation\n${lab}` : "",
  ].filter(Boolean).join("\n\n");
  // Authored learner material passes the same answer/teacher-section filter as legacy bodies.
  const learnerSections = projectLegacyBody(sections);
  const assessment = safeAssessment(source.assessment);
  return {
    title: scalarText(source.title),
    grade: scalarGrade(source.grade),
    subject: scalarText(source.subject),
    lessonFormat: scalarText(source.lessonFormat),
    objectives: list(source.objectives),
    activities: [...classwork, ...independent, ...(project ? [project] : [])],
    body: learnerSections,
    body_standard: learnerSections,
    body_block: learnerSections,
    assessment,
    moeAlignments: list(source.moeAlignments),
    labs,
    pseudoLabs: safePseudoLabs(source.pseudoLabs),
    simulationDefinitions: safeSimulations(source.simulationDefinitions),
    takeawaySummary: text(source.takeawaySummary),
    durationMins: typeof source.durationMins === "number" ? source.durationMins : undefined,
    problemSets: safeProblemSets(source.problemSets),
    studentReady: true,
  };
}

function projectNativeLesson(source: LessonPayloadRecord): LessonPayloadRecord {
  try {
    // Rebuilt field by field with primitive type checks: malformed stored data (an object in keyPoints,
    // a key under a title) throws here and the lesson is not student-ready.
    const lessonExperience = rebuildLearnerExperience(toLessonExperience(source[CURRICULUM_V2_PAYLOAD_KEY] as CurriculumLessonV2));
    validateLessonExperience(lessonExperience);
    // Re-check the stored artifact: an instant-feedback key may only exist in a formative scene.
    if (lessonExperience.scenes.some((scene) => scene.interaction.kind === "MULTIPLE_CHOICE" && scene.type !== "CHECK_UNDERSTANDING" && scene.type !== "PRACTICE" && scene.type !== "GUIDED_EXAMPLE")) throw new Error("native_answer_key_outside_formative_scene");
    return { title: lessonExperience.title, grade: lessonExperience.grade, subject: lessonExperience.subject, lessonExperience, body: "", body_standard: "", body_block: "", objectives: lessonExperience.objectives.map((objective) => objective.statement), studentReady: true };
  } catch {
    return { title: typeof source.title === "string" ? source.title : undefined, body: "", body_standard: "", body_block: "", objectives: [], studentReady: false };
  }
}

/**
 * Return only text that is already safe for learner delivery. Audio workers
 * reload curriculum rows independently of the student request, so they must
 * apply the same projection before selecting narration text.
 */
export function selectStudentLessonAudioText(payload: unknown): string {
  const projected = projectStudentLessonPayload(payload);
  return text(projected.body_standard) || text(projected.body) || text(projected.body_block);
}

/**
 * Project a standalone virtual-lab payload for the student lab route.
 * Teacher notes and answer/rubric fields remain server-side for evaluation.
 */
export function projectStudentLabPayload(payload: unknown): LessonPayloadRecord {
  return (safeLabs([payload])[0] as LessonPayloadRecord | undefined) ?? {};
}

/**
 * Learner-safe catalogue entry for curriculum listings. Built from explicit fields only: the stored
 * payload never appears in a student listing.
 */
export type StudentCurriculumSummary = Readonly<{
  contentId: string;
  title: string;
  displayTitle: string;
  grade: number;
  subject: string;
  contentType: string;
  version: string;
  audioStatus: string;
  updatedAt: string;
}>;

export function projectStudentCurriculumSummary(row: {
  contentId: string;
  title: string;
  displayTitle: string;
  grade: number;
  subject: string;
  contentType: string;
  version: string;
  audioStatus: string;
  updatedAt: Date | string;
}): StudentCurriculumSummary {
  return {
    contentId: row.contentId,
    title: row.title,
    displayTitle: row.displayTitle,
    grade: row.grade,
    subject: row.subject,
    contentType: row.contentType,
    version: row.version,
    audioStatus: row.audioStatus,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}
