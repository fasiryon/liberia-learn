type StudentMaterials = {
  learnerMaterial?: unknown;
  guidedItems?: unknown;
  independentItems?: unknown;
  masteryTask?: unknown;
  classwork?: unknown;
  homework?: unknown;
  project?: unknown;
  lab?: unknown;
};

type LessonPayloadRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

function numbered(values: string[]): string {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function approvedArtifacts(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as LessonPayloadRecord;
    if (record.approved !== true || record.renderStatus !== "ready") return [];
    const { teacherGuide: _teacherGuide, ...safeRecord } = record;
    return [safeRecord];
  });
}

function safeLabs(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const lab = item as LessonPayloadRecord;
    const procedure = Array.isArray(lab.procedure)
      ? lab.procedure.flatMap((step) => {
          if (!step || typeof step !== "object" || Array.isArray(step)) return [];
          const record = step as LessonPayloadRecord;
          const { teacherNote: _teacherNote, ...safeStep } = record;
          return [safeStep];
        })
      : [];
    const observationForm = Array.isArray(lab.observationForm)
      ? lab.observationForm
      : [];
    const analysisQuestions = Array.isArray(lab.analysisQuestions)
      ? lab.analysisQuestions.flatMap((question) => {
          if (!question || typeof question !== "object" || Array.isArray(question)) return [];
          const record = question as LessonPayloadRecord;
          const { expectedAnswer: _expectedAnswer, scoringRubric: _scoringRubric, ...safeQuestion } = record;
          return [safeQuestion];
        })
      : [];
    const {
      id,
      title,
      type,
      durationMinutes,
      subject,
      gradeLevel,
      labObjective,
      materialsNeeded,
      safetyNotes,
      connectionToLesson,
      offlineCapable,
      virtualAlternative,
    } = lab;
    return [{
      id,
      title,
      type,
      durationMinutes,
      subject,
      gradeLevel,
      labObjective,
      materialsNeeded,
      safetyNotes,
      procedure,
      observationForm,
      analysisQuestions,
      connectionToLesson,
      offlineCapable,
      virtualAlternative,
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

const TEACHER_ONLY_SECTION_RE = /##\s*(?:Teacher Explanation|Teacher Guidance|Teacher Talk|Teacher Checkpoints|Teacher Planning Record|Assessment Alignment|Evidence Record|Remediation Branch|Extension Branch|Lesson Study Notes)\b/i;

/**
 * Build the learner-safe projection for a curriculum payload.
 *
 * NR-13 stores a rich teacher plan beside learner materials. Student routes
 * must never return the teacher plan, answer guide, worked solution, authority
 * audit details, or raw assessment keys. This projection is intentionally
 * allow-listed and keeps legacy payloads compatible until they are replaced.
 */
export function projectStudentLessonPayload(payload: unknown): LessonPayloadRecord {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const source = payload as LessonPayloadRecord;
  const materials = source.studentMaterials as StudentMaterials | undefined;
  const hasAuthoredMaterials = Boolean(materials && typeof materials === "object" && text(materials.learnerMaterial));

  if (!hasAuthoredMaterials) {
    const legacyBody = text(source.body_standard) || text(source.body) || text(source.content);
    if (TEACHER_ONLY_SECTION_RE.test(legacyBody)) {
      return {
        title: source.title,
        grade: source.grade,
        subject: source.subject,
        lessonFormat: source.lessonFormat,
        objectives: [],
        activities: [],
        body: "",
        body_standard: "",
        body_block: "",
        studentReady: false,
      };
    }
    const legacyAssessment = Array.isArray(source.assessment)
      ? source.assessment.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return item;
          const record = item as LessonPayloadRecord;
          const { answerKey: _answerKey, correctIndex: _correctIndex, explanation: _explanation, ...safeItem } = record;
          return safeItem;
        })
      : source.assessment;
    return {
      title: source.title,
      grade: source.grade,
      subject: source.subject,
      lessonFormat: source.lessonFormat,
      objectives: list(source.objectives),
      activities: list(source.activities),
      body: legacyBody,
      body_standard: legacyBody,
      body_block: text(source.body_block) || legacyBody,
      assessment: legacyAssessment,
      moeAlignments: list(source.moeAlignments),
      labs: safeLabs(source.labs),
      pseudoLabs: approvedArtifacts(source.pseudoLabs),
      simulationDefinitions: approvedArtifacts(source.simulationDefinitions),
      takeawaySummary: text(source.takeawaySummary),
      studentReady: true,
    };
  }

  const guided = list(materials?.guidedItems);
  const independent = list(materials?.independentItems);
  const classwork = list(materials?.classwork);
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
  const groupWork = guided.length
    ? `Discuss the material with your group. Take turns explaining which words or details support each answer. Then complete your own response.\n\n${numbered(guided)}`
    : "Discuss the material with your group, explain your evidence, and complete your own response afterward.";
  const learnerSections = [
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
  const assessment = Array.isArray(source.assessment)
    ? source.assessment.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const record = item as LessonPayloadRecord;
        const { answerKey: _answerKey, correctIndex: _correctIndex, explanation: _explanation, ...safeItem } = record;
        return safeItem;
      })
    : undefined;
  return {
    title: source.title,
    grade: source.grade,
    subject: source.subject,
    lessonFormat: source.lessonFormat,
    objectives: list(source.objectives),
    activities: [...classwork, ...independent, ...(project ? [project] : [])],
    body: learnerSections,
    body_standard: learnerSections,
    body_block: learnerSections,
    assessment,
    moeAlignments: list(source.moeAlignments),
    labs,
    pseudoLabs: approvedArtifacts(source.pseudoLabs),
    simulationDefinitions: approvedArtifacts(source.simulationDefinitions),
    takeawaySummary: text(source.takeawaySummary),
    studentReady: true,
  };
}
