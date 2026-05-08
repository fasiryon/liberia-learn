export type RegeneratedLessonPayload = {
  title?: string;
  learningObjectives?: unknown;
  objectives?: unknown;
  content?: string;
  lessonContent?: string;
  body?: string;
  body_standard?: string;
  assessmentQuestions?: unknown;
  quiz?: { questions?: unknown };
  teacherNotesSummary?: string;
  teacherGuide?: string;
  studentWorksheet?: string;
  homeworkSet?: string;
  aiTutorContext?: string;
};

export type QualityGateResult = {
  passed: boolean;
  reason: string | null;
  contentLength: number;
};

const REQUIRED_SECTIONS = [
  /objective/i,
  /introduction|warm[-\s]?up/i,
  /guided practice|teacher model/i,
  /independent practice|student practice/i,
  /assessment|exit ticket|quiz/i,
];

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\[insert\b/i,
  /lorem ipsum/i,
  /placeholder/i,
  /as an ai language model/i,
  /i'?m sorry/i,
  /i cannot/i,
  /Ã|Â|â€|â€œ|â€\u009d|�/,
];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function extractLessonText(payload: unknown): string {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object") return "";
  const p = payload as RegeneratedLessonPayload;
  return (
    asString(p.lessonContent) ||
    asString(p.content) ||
    asString(p.body_standard) ||
    asString(p.body)
  );
}

export function validateRegeneratedLesson(payload: unknown): QualityGateResult {
  const content = extractLessonText(payload);
  const p = (payload && typeof payload === "object" ? payload : {}) as RegeneratedLessonPayload;
  const objectives = asArray(p.learningObjectives ?? p.objectives);
  const questions = asArray(p.assessmentQuestions ?? p.quiz?.questions);
  const lower = content.toLowerCase();

  if (content.length < 800) return { passed: false, reason: "content_under_800_chars", contentLength: content.length };
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(content))) {
    return { passed: false, reason: "placeholder_or_ai_apology_or_mojibake", contentLength: content.length };
  }
  if (objectives.length === 0 && !lower.includes("objective")) {
    return { passed: false, reason: "empty_objectives", contentLength: content.length };
  }
  if (questions.length === 0 && !/assessment|exit ticket|quiz/i.test(content)) {
    return { passed: false, reason: "empty_assessment", contentLength: content.length };
  }
  if (REQUIRED_SECTIONS.filter((pattern) => pattern.test(content)).length < 4) {
    return { passed: false, reason: "required_lesson_structure_missing", contentLength: content.length };
  }
  const title = asString(p.title);
  if (title && content.replace(title, "").trim().length < 800) {
    return { passed: false, reason: "duplicated_title_only_content", contentLength: content.length };
  }

  return { passed: true, reason: null, contentLength: content.length };
}
