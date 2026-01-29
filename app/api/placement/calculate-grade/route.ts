// app/api/placement/calculate-grade/route.ts
import { NextResponse } from "next/server";

interface Answer {
  questionId: string;
  difficulty: number;
  correct: boolean;
  timeSpent?: number;
}

export async function POST(req: Request) {
  try {
    const { answers }: { answers: Answer[] } = await req.json();

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

    return NextResponse.json({
      recommendedGrade,
      accuracyRate: Math.round(accuracyRate),
      weightedAccuracy: Math.round(weightedAccuracy),
      totalQuestions,
      correctAnswers,
      confidence,
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
