// app/api/placement/calculate-grade/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { routedCompletion } from "@/lib/ai/router";

interface Answer {
  questionId: string;
  difficulty: number;
  correct: boolean;
  timeSpent?: number;
  selectedAnswer?: number | null;
}

interface QuestionForAnalysis {
  question: string;
  options: string[];
  difficulty: number;
  strand?: string | null;
}

type PlacementBand = "foundational" | "developing" | "proficient" | "advanced";

type AiPlacementAnalysis = {
  overallNarrative: string;
  strengths: string[];
  areasForGrowth: string[];
  subjectBreakdown: Record<string, { score: number; label: string }>;
  teacherNote: string;
  confidenceExplanation: string;
  recommendedNextSteps: string[];
};

export function derivePlacementBand(rawScore: number, totalQuestions: number): PlacementBand {
  const percentage = totalQuestions > 0 ? (rawScore / totalQuestions) * 100 : 0;
  if (percentage <= 40) return "foundational";
  if (percentage <= 70) return "developing";
  if (percentage <= 85) return "proficient";
  return "advanced";
}

function parseAiPlacementAnalysis(content: string): AiPlacementAnalysis {
  let parsed: unknown;
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw Object.assign(new Error("Failed to parse placement analysis from AI"), { status: 502 });
  }

  const candidate = parsed as Partial<AiPlacementAnalysis>;
  const validBreakdown =
    candidate.subjectBreakdown &&
    typeof candidate.subjectBreakdown === "object" &&
    Object.values(candidate.subjectBreakdown).every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as { score?: unknown }).score === "number" &&
        typeof (entry as { label?: unknown }).label === "string"
    );

  if (
    typeof candidate.overallNarrative !== "string" ||
    !Array.isArray(candidate.strengths) ||
    candidate.strengths.some((item) => typeof item !== "string") ||
    !Array.isArray(candidate.areasForGrowth) ||
    candidate.areasForGrowth.some((item) => typeof item !== "string") ||
    !validBreakdown ||
    typeof candidate.teacherNote !== "string" ||
    typeof candidate.confidenceExplanation !== "string" ||
    !Array.isArray(candidate.recommendedNextSteps) ||
    candidate.recommendedNextSteps.some((item) => typeof item !== "string")
  ) {
    throw Object.assign(new Error("AI returned an invalid placement analysis payload"), { status: 502 });
  }

  return {
    overallNarrative: candidate.overallNarrative.trim(),
    strengths: candidate.strengths.map((item) => item.trim()),
    areasForGrowth: candidate.areasForGrowth.map((item) => item.trim()),
    subjectBreakdown: candidate.subjectBreakdown as Record<string, { score: number; label: string }>,
    teacherNote: candidate.teacherNote.trim(),
    confidenceExplanation: candidate.confidenceExplanation.trim(),
    recommendedNextSteps: candidate.recommendedNextSteps.map((item) => item.trim()),
  };
}

async function generatePlacementAnalysis(input: {
  questions: QuestionForAnalysis[];
  answers: Answer[];
  recommendedGrade: number;
  band: PlacementBand;
  confidence: string;
}): Promise<AiPlacementAnalysis> {
  const analysisPrompt = JSON.stringify(
    input.questions.map((question, index) => ({
      question: question.question,
      options: question.options,
      selectedAnswer: input.answers[index]?.selectedAnswer ?? null,
      correct: input.answers[index]?.correct ?? false,
      difficulty: input.answers[index]?.difficulty ?? question.difficulty,
      strand: question.strand ?? null,
    }))
  );

  const result = await routedCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are an expert Liberian mathematics placement analyst. Return JSON only with the exact requested shape. Keep language plain, teacher-friendly, and specific.",
      },
      {
        role: "user",
        content: `Analyze this placement test result and return JSON only.

Recommended grade: ${input.recommendedGrade}
Placement band: ${input.band}
Confidence label: ${input.confidence}

Question results:
${analysisPrompt}

Return exactly:
{
  "overallNarrative": "2-3 plain-language sentences",
  "strengths": ["strength 1", "strength 2"],
  "areasForGrowth": ["area 1", "area 2"],
  "subjectBreakdown": {
    "numberSense": { "score": 80, "label": "Strong" },
    "operations": { "score": 60, "label": "Developing" }
  },
  "teacherNote": "1-2 sentences for the teacher",
  "confidenceExplanation": "Plain-language explanation of confidence",
  "recommendedNextSteps": [
    "Specific action 1 for the teacher",
    "Specific action 2 for the student"
  ]
}`,
      },
    ],
    maxTokens: 900,
    forceSmartTier: true,
  });

  return parseAiPlacementAnalysis(result.content);
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("STUDENT");
    const { answers, questions }: { answers: Answer[]; questions?: QuestionForAnalysis[] } = await req.json();

    if (!answers || answers.length === 0) {
      return NextResponse.json(
        { error: "No answers provided" },
        { status: 400 }
      );
    }

    const totalQuestions = answers.length;
    const correctAnswers = answers.filter((a) => a.correct).length;
    const accuracyRate = (correctAnswers / totalQuestions) * 100;

    // Weighted by difficulty (1–5)
    let weightedScore = 0;
    let totalWeight = 0;

    for (const answer of answers) {
      const weight = answer.difficulty || 1;
      totalWeight += weight;
      if (answer.correct) {
        weightedScore += weight;
      }
    }

    const weightedAccuracy = totalWeight
      ? (weightedScore / totalWeight) * 100
      : 0;

    const avgDifficulty =
      answers.reduce((sum, a) => sum + (a.difficulty || 1), 0) /
      answers.length;

    // Map performance to recommended grade (very rough, we can tune later)
    let recommendedGrade = 1;

    if (weightedAccuracy >= 90) {
      if (avgDifficulty >= 4.5) recommendedGrade = 12;
      else if (avgDifficulty >= 4) recommendedGrade = 11;
      else if (avgDifficulty >= 3.5) recommendedGrade = 10;
      else if (avgDifficulty >= 3) recommendedGrade = 9;
      else if (avgDifficulty >= 2.5) recommendedGrade = 8;
      else if (avgDifficulty >= 2) recommendedGrade = 7;
      else recommendedGrade = 6;
    } else if (weightedAccuracy >= 80) {
      if (avgDifficulty >= 4) recommendedGrade = 10;
      else if (avgDifficulty >= 3.5) recommendedGrade = 9;
      else if (avgDifficulty >= 3) recommendedGrade = 8;
      else if (avgDifficulty >= 2.5) recommendedGrade = 7;
      else if (avgDifficulty >= 2) recommendedGrade = 6;
      else recommendedGrade = 5;
    } else if (weightedAccuracy >= 70) {
      if (avgDifficulty >= 4) recommendedGrade = 9;
      else if (avgDifficulty >= 3) recommendedGrade = 8;
      else if (avgDifficulty >= 2.5) recommendedGrade = 7;
      else if (avgDifficulty >= 2) recommendedGrade = 6;
      else recommendedGrade = 5;
    } else if (weightedAccuracy >= 60) {
      if (avgDifficulty >= 3) recommendedGrade = 7;
      else if (avgDifficulty >= 2.5) recommendedGrade = 6;
      else if (avgDifficulty >= 2) recommendedGrade = 5;
      else recommendedGrade = 4;
    } else {
      if (avgDifficulty >= 2.5) recommendedGrade = 5;
      else if (avgDifficulty >= 2) recommendedGrade = 4;
      else if (avgDifficulty >= 1.5) recommendedGrade = 3;
      else recommendedGrade = 2;
    }

    // Confidence based on difficulty variance
    const meanDifficulty = avgDifficulty;
    const variance =
      answers.reduce(
        (sum, a) => sum + Math.pow((a.difficulty || 1) - meanDifficulty, 2),
        0
      ) / answers.length;

    const confidence =
      variance < 0.5 ? "high" : variance < 1.5 ? "medium" : "low";

    const band = derivePlacementBand(correctAnswers, totalQuestions);
    const normalizedQuestions =
      questions && questions.length === answers.length
        ? questions
        : answers.map((answer, index) => ({
            question: `Question ${index + 1}`,
            options: [],
            difficulty: answer.difficulty,
            strand: null,
          }));

    const aiAnalysis = await generatePlacementAnalysis({
      questions: normalizedQuestions,
      answers,
      recommendedGrade,
      band,
      confidence,
    });

    await logAudit({
      userId: user.id,
      action: "placement.grade.calculated",
      resourceType: "placement_test",
      schoolId: user.schoolId,
      details: {
        recommendedGrade,
        band,
        confidence,
        accuracyRate: Math.round(accuracyRate),
        weightedAccuracy: Math.round(weightedAccuracy),
      },
    });

    return NextResponse.json({
      recommendedGrade,
      band,
      accuracyRate: Math.round(accuracyRate),
      weightedAccuracy: Math.round(weightedAccuracy),
      totalQuestions,
      correctAnswers,
      confidence,
      aiAnalysis,
      details: {
        averageDifficulty: avgDifficulty,
        difficultyRange: {
          min: Math.min(...answers.map((a) => a.difficulty || 1)),
          max: Math.max(...answers.map((a) => a.difficulty || 1)),
        },
      },
    });
  } catch (error: any) {
    console.error("Calculate grade error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate grade" },
      { status: 500 }
    );
  }
}
