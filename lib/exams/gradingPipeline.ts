import type { ExamAttempt, ExamQuestion } from "@prisma/client";

/** Learner sent no answer for this question. Recorded as blank, never as option 0. */
export const BLANK_ANSWER = -1;

export type QuestionOutcome = "CORRECT" | "INCORRECT" | "BLANK" | "INVALID";

export type GradeResult = {
  /** Earned points / total approved points (0..1). */
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  earnedPoints: number;
  totalPoints: number;
  blankCount: number;
  invalidCount: number;
  perQuestion: { questionId: string; correct: boolean; outcome: QuestionOutcome; points: number }[];
  weakMoeCodes: string[];
};

type GradeableAttempt = ExamAttempt & {
  passingScore?: number;
  exam?: { passingScore?: number | null } | null;
};

type GradeableQuestion = Pick<ExamQuestion, "id" | "correctIndex" | "moeCode"> & Partial<Pick<ExamQuestion, "points" | "options">>;

/**
 * Positional grading with explicit identity and approved points:
 * - when `questionIds` is supplied it must equal the graded question order, so answers cannot be
 *   matched to the wrong question after an edit or reorder;
 * - each question is worth its approved `points` (default 1 for legacy rows);
 * - a missing answer or `BLANK_ANSWER` is BLANK (0 points); an index outside the question's options
 *   is INVALID (0 points, reported so the caller can refuse the submission);
 * - single-choice questions have no partial credit.
 */
export function gradeAttempt(attempt: ExamAttempt, questions: GradeableQuestion[], options?: { questionIds?: readonly string[] }): GradeResult;
export function gradeAttempt(attempt: GradeableAttempt, questions: GradeableQuestion[], options: { questionIds?: readonly string[] } = {}): GradeResult {
  if (options.questionIds && (options.questionIds.length !== questions.length || options.questionIds.some((id, index) => id !== questions[index].id))) {
    throw Object.assign(new Error("Exam questions changed since this attempt started"), { status: 409, code: "exam_question_identity_mismatch" });
  }
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  if (answers.length > questions.length) {
    throw Object.assign(new Error("More answers than questions"), { status: 400, code: "exam_answers_exceed_questions" });
  }
  const perQuestion = questions.map((question, index) => {
    const answer = answers[index];
    const points = Number.isFinite(question.points) && (question.points as number) > 0 ? (question.points as number) : 1;
    const optionCount = Array.isArray(question.options) ? question.options.length : null;
    let outcome: QuestionOutcome;
    if (answer === undefined || answer === null || answer === BLANK_ANSWER) outcome = "BLANK";
    else if (!Number.isInteger(answer) || answer < 0 || (optionCount !== null && answer >= optionCount)) outcome = "INVALID";
    else outcome = answer === question.correctIndex ? "CORRECT" : "INCORRECT";
    return { questionId: question.id, correct: outcome === "CORRECT", outcome, points };
  });

  const totalPoints = perQuestion.reduce((sum, item) => sum + item.points, 0);
  const earnedPoints = perQuestion.filter((item) => item.correct).reduce((sum, item) => sum + item.points, 0);
  const score = totalPoints > 0 ? earnedPoints / totalPoints : 0;
  const passingScore = attempt.exam?.passingScore ?? attempt.passingScore ?? 0.7;
  const weakMoeCodes = Array.from(
    new Set(
      questions
        .filter((_question, index) => !perQuestion[index].correct)
        .map((question) => question.moeCode)
        .filter(Boolean)
    )
  );

  return {
    score,
    passed: score >= passingScore,
    correctCount: perQuestion.filter((item) => item.correct).length,
    totalQuestions: questions.length,
    earnedPoints,
    totalPoints,
    blankCount: perQuestion.filter((item) => item.outcome === "BLANK").length,
    invalidCount: perQuestion.filter((item) => item.outcome === "INVALID").length,
    perQuestion,
    weakMoeCodes,
  };
}
