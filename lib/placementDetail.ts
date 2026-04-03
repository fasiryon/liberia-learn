import { getPlacementReviewStatus } from "@/lib/placement";

type PlacementQuestionRecord = {
  questionId?: string;
  question?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  difficulty?: number;
  subject?: string;
  strand?: string;
  moeStandard?: string | null;
  whyThisQuestion?: string;
  commonMistake?: string;
  hint?: string;
};

type PlacementAnswerRecord = {
  questionId?: string;
  difficulty?: number;
  correct?: boolean;
  timeSpent?: number;
  selectedAnswer?: number;
};

export type PlacementResponseItem = {
  questionId: string;
  question: string;
  selectedAnswer: number | null;
  selectedAnswerText: string | null;
  correctAnswer: number | null;
  correctAnswerText: string | null;
  isCorrect: boolean;
  concept: string;
  subject: string | null;
  difficulty: number | null;
  explanation: string | null;
  whyThisQuestion: string | null;
  commonMistake: string | null;
  hint: string | null;
  moeStandard: string | null;
  strand: string | null;
  timeSpentSeconds: number;
  options: string[];
};

function asQuestions(value: unknown): PlacementQuestionRecord[] {
  return Array.isArray(value) ? (value as PlacementQuestionRecord[]) : [];
}

function asAnswers(value: unknown): PlacementAnswerRecord[] {
  return Array.isArray(value) ? (value as PlacementAnswerRecord[]) : [];
}

export function buildPlacementResponses(
  questionsValue: unknown,
  answersValue: unknown
): PlacementResponseItem[] {
  const questions = asQuestions(questionsValue);
  const answers = asAnswers(answersValue);

  return questions.map((question, index) => {
    const questionId = question.questionId ?? `q${index + 1}`;
    const answer =
      answers.find((entry) => entry.questionId === questionId) ?? answers[index] ?? null;
    const options = Array.isArray(question.options) ? question.options : [];
    const selectedAnswer =
      typeof answer?.selectedAnswer === "number" ? answer.selectedAnswer : null;
    const correctAnswer =
      typeof question.correctAnswer === "number" ? question.correctAnswer : null;
    const selectedAnswerText =
      selectedAnswer != null && selectedAnswer >= 0 && selectedAnswer < options.length
        ? options[selectedAnswer]
        : null;
    const correctAnswerText =
      correctAnswer != null && correctAnswer >= 0 && correctAnswer < options.length
        ? options[correctAnswer]
        : null;

    return {
      questionId,
      question: question.question ?? "Untitled question",
      selectedAnswer,
      selectedAnswerText,
      correctAnswer,
      correctAnswerText,
      isCorrect: Boolean(answer?.correct),
      concept: question.strand ?? question.moeStandard ?? "Unknown concept",
      subject: question.subject ?? null,
      difficulty:
        typeof question.difficulty === "number"
          ? question.difficulty
          : typeof answer?.difficulty === "number"
          ? answer.difficulty
          : null,
      explanation: question.explanation ?? null,
      whyThisQuestion: question.whyThisQuestion ?? null,
      commonMistake: question.commonMistake ?? null,
      hint: question.hint ?? null,
      moeStandard: question.moeStandard ?? null,
      strand: question.strand ?? null,
      timeSpentSeconds: typeof answer?.timeSpent === "number" ? answer.timeSpent : 0,
      options,
    };
  });
}

export function serializePlacementDetail(placement: {
  id: string;
  createdAt: Date;
  band: string;
  levelLabel: string;
  estimatedGrade: number;
  rawScore: number;
  totalQuestions: number;
  details: unknown;
  questions: unknown;
  answers: unknown;
  aiAnalysis: unknown;
  teacherDecision: string | null;
  teacherGrade: number | null;
  teacherReason: string | null;
  reviewedAt: Date | null;
  student: {
    id: string;
    currentGrade: number | null;
    user: {
      name: string | null;
      email: string | null;
    };
  };
}) {
  const responses = buildPlacementResponses(placement.questions, placement.answers);
  const timeTakenSeconds = responses.reduce((sum, response) => sum + response.timeSpentSeconds, 0);

  return {
    id: placement.id,
    createdAt: placement.createdAt.toISOString(),
    band: placement.band,
    levelLabel: placement.levelLabel,
    estimatedGrade: placement.estimatedGrade,
    rawScore: placement.rawScore,
    totalQuestions: placement.totalQuestions,
    details: placement.details,
    questions: placement.questions,
    answers: placement.answers,
    responses,
    aiAnalysis: placement.aiAnalysis,
    teacherDecision: placement.teacherDecision,
    teacherGrade: placement.teacherGrade,
    teacherReason: placement.teacherReason,
    reviewedAt: placement.reviewedAt?.toISOString() ?? null,
    status: getPlacementReviewStatus(placement.teacherDecision),
    student: {
      id: placement.student.id,
      name: placement.student.user.name ?? placement.student.user.email ?? "Student",
      currentGrade: placement.student.currentGrade,
      timeTakenSeconds,
    },
  };
}
