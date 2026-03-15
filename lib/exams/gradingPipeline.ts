import type { ExamAttempt, ExamQuestion } from "@prisma/client";

export type GradeResult = {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  perQuestion: { questionId: string; correct: boolean }[];
  weakMoeCodes: string[];
};

type GradeableAttempt = ExamAttempt & {
  passingScore?: number;
  exam?: { passingScore?: number | null } | null;
};

export function gradeAttempt(attempt: ExamAttempt, questions: ExamQuestion[]): GradeResult;
export function gradeAttempt(attempt: GradeableAttempt, questions: ExamQuestion[]): GradeResult {
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  const perQuestion = questions.map((question, index) => ({
    questionId: question.id,
    correct: answers[index] === question.correctIndex,
  }));

  const correctCount = perQuestion.filter((item) => item.correct).length;
  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? correctCount / totalQuestions : 0;
  const passingScore = attempt.exam?.passingScore ?? attempt.passingScore ?? 0.7;
  const weakMoeCodes = Array.from(
    new Set(
      questions
        .filter((question, index) => answers[index] !== question.correctIndex)
        .map((question) => question.moeCode)
        .filter(Boolean)
    )
  );

  return {
    score,
    passed: score >= passingScore,
    correctCount,
    totalQuestions,
    perQuestion,
    weakMoeCodes,
  };
}
