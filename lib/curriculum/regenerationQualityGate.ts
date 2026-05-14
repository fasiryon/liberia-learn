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

export type DepthValidationResult = {
  valid: boolean;
  slideCount: number;
  wordCount: number;
  hasForbidden: boolean;
  failReasons: string[];
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
  /Ã|Â|â€|â€œ|â€|â€˜|ï¿½|â€"/,
];

const DEPTH_FORBIDDEN_PHRASES = [
  'Pause for student explanation',
  'Add content here',
  'Insert example',
  'placeholder',
  'TODO',
  'TBD',
  '[content]',
  '[insert',
  'lorem ipsum',
  'add your',
  'fill in',
  'write here',
  'example here',
  'content goes here',
];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSections(text: string): number {
  return (text.match(/^##\s+/gm) ?? []).length;
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

function getMinWords(grade: number): number {
  if (grade <= 3) return 700;
  if (grade <= 6) return 900;
  return 1200;
}

function getMinSlides(grade: number): number {
  if (grade <= 3) return 10;
  if (grade <= 6) return 12;
  return 15;
}

/**
 * Depth validation gate — enforced before any DB write.
 * G1–G3: 10+ sections and 700+ words.
 * G4–G6: 12+ sections and 900+ words.
 * G7+:   15+ sections and 1200+ words.
 * Rejects any output containing forbidden placeholder phrases.
 * Returns detailed failure reasons so the worker can log them.
 */
export function validateLessonDepth(lesson: unknown, grade: number): DepthValidationResult {
  const content = extractLessonText(lesson);
  const serialized = typeof lesson === "string" ? lesson : JSON.stringify(lesson ?? "");
  const minSlides = getMinSlides(grade);
  const minWords = getMinWords(grade);

  const slideCount = countSections(content);
  const wordCount = countWords(content);
  const hasForbidden = DEPTH_FORBIDDEN_PHRASES.some((phrase) =>
    serialized.toLowerCase().includes(phrase.toLowerCase())
  );

  const failReasons: string[] = [];
  if (slideCount < minSlides) failReasons.push(`slide_count_${slideCount}_below_min_${minSlides}`);
  if (wordCount < minWords) failReasons.push(`word_count_${wordCount}_below_min_${minWords}`);
  if (hasForbidden) failReasons.push("forbidden_placeholder_phrase_detected");

  return {
    valid: failReasons.length === 0,
    slideCount,
    wordCount,
    hasForbidden,
    failReasons,
  };
}
