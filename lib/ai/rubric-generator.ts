// lib/ai/rubric-generator.ts
import { prisma } from "@/lib/db";
import { HomeworkGrader } from "@/lib/ai/homework-grader";
import { routedCompletion } from "@/lib/ai/routedCompletion";


export interface RubricQuestion {
  index: number;
  questionText: string;
  expectedAnswer: string;
  keyPoints: string[];
  maxPoints: number;
  gradingNotes: string;
}

export interface HomeworkRubric {
  homeworkId: string;
  title: string;
  questions: RubricQuestion[];
  generatedAt: string;
}

export async function generateHomeworkRubric(
  homeworkId: string
): Promise<HomeworkRubric> {
  const homework = await prisma.homework.findUnique({
    where: { id: homeworkId },
  });

  if (!homework) throw new Error(`Homework ${homeworkId} not found`);

  const questions = (homework.questions as any[]) ?? [];

  const prompt = `You are an expert education rubric generator.

Given this homework:
Title: ${homework.title}
Instructions: ${homework.instructions ?? "None"}
Questions: ${JSON.stringify(questions, null, 2)}

Generate a grading rubric as JSON with this exact structure:
{
  "questions": [
    {
      "index": 0,
      "questionText": "...",
      "expectedAnswer": "The ideal/correct answer",
      "keyPoints": ["key concept 1", "key concept 2"],
      "maxPoints": 10,
      "gradingNotes": "What to look for when grading"
    }
  ]
}

Return ONLY valid JSON. No backticks, no explanation.`;

  const completion = await routedCompletion({
    messages: [
      { role: "system", content: "Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    maxTokens: 1500,
  });

  const raw = completion.content ?? "{}";
  const parsed = JSON.parse(raw);

  const rubric: HomeworkRubric = {
    homeworkId,
    title: homework.title,
    questions: parsed.questions ?? [],
    generatedAt: new Date().toISOString(),
  };

  // Save rubric to homework
  await prisma.homework.update({
    where: { id: homeworkId },
    data: { rubricJson: rubric as any },
  });

  return rubric;
}

export function scoreAnswerAgainstRubric(
  studentAnswer: string,
  rubricQ: RubricQuestion
): { score: number; maxScore: number; feedback: string } {
  if (!studentAnswer || !studentAnswer.trim()) {
    return {
      score: 0,
      maxScore: rubricQ.maxPoints,
      feedback: "No answer provided.",
    };
  }

  const answerLower = studentAnswer.toLowerCase();
  let matchedPoints = 0;

  for (const keyPoint of rubricQ.keyPoints) {
    const words = keyPoint
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    const matched = words.filter((w) => answerLower.includes(w)).length;
    if (words.length > 0 && matched / words.length >= 0.5) {
      matchedPoints++;
    }
  }

  const totalKeyPoints = rubricQ.keyPoints.length || 1;
  const ratio = matchedPoints / totalKeyPoints;
  const score = Math.round(ratio * rubricQ.maxPoints);

  let feedback: string;
  if (ratio >= 0.8) feedback = "Excellent answer covering key concepts.";
  else if (ratio >= 0.5) feedback = "Good attempt but some key points missing.";
  else if (ratio > 0) feedback = "Partial answer — review the key concepts.";
  else feedback = "Answer does not address the expected key points.";

  return { score, maxScore: rubricQ.maxPoints, feedback };
}

export async function gradeSubmissionWithRubric(
  submissionId: string
): Promise<{
  overallScore: number;
  questions: Array<{ score: number; maxScore: number; feedback: string }>;
  usedRubric: boolean;
}> {
  const submission = await prisma.homeworkSubmission.findUnique({
    where: { id: submissionId },
    include: { Homework: true },
  });

  if (!submission) throw new Error(`Submission ${submissionId} not found`);

  const homework = submission.Homework;
  const rubricJson = homework.rubricJson as any;

  // If no rubric, fall back to AI grader
  if (!rubricJson || !rubricJson.questions) {
    const result = await HomeworkGrader.gradeSubmission(submissionId);
    return {
      overallScore: result.overallScore,
      questions: result.questions.map((q) => ({
        score: q.score,
        maxScore: q.maxScore,
        feedback: q.feedback,
      })),
      usedRubric: false,
    };
  }

  const answers = (submission.answers as any[]) ?? [];
  const rubricQuestions: RubricQuestion[] = rubricJson.questions;

  const questionResults = rubricQuestions.map((rq, i) => {
    const studentAnswer =
      typeof answers[i] === "string"
        ? answers[i]
        : answers[i]?.answer ?? answers[i]?.text ?? "";
    return scoreAnswerAgainstRubric(studentAnswer, rq);
  });

  const totalScore = questionResults.reduce((s, q) => s + q.score, 0);
  const totalMax = questionResults.reduce((s, q) => s + q.maxScore, 0);
  const overallScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  // Save results
  await prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: {
      aiScore: overallScore,
      aiFeedback: {
        gradedByRubric: true,
        overallScore,
        questions: questionResults,
      },
    },
  });

  return { overallScore, questions: questionResults, usedRubric: true };
}
