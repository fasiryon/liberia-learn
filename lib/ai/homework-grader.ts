// lib/ai/homework-grader.ts
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type QuestionFeedback = {
  questionIndex: number;
  score: number;      // score for this question
  maxScore: number;   // max score for this question
  feedback: string;   // explanation for the student
};

export type GradingResult = {
  overallScore: number;         // 0–100
  overallFeedback: string;      // general comment
  questions: QuestionFeedback[];
};

async function getOrCreateGraderAgent() {
  const name = "HomeworkGrader";

  let agent = await prisma.agent.findFirst({
    where: { name, type: "grader" },
  });

  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        name,
        type: "grader",
        status: "idle",
        config: {
          model: "gpt-4.1-mini",
          description:
            "AI agent that grades student homework and gives structured feedback.",
        },
      },
    });
  }

  return agent;
}

export class HomeworkGrader {
  /**
   * Grade a homework submission using OpenAI and save results to the database.
   * - Reads Homework + HomeworkSubmission
   * - Calls OpenAI to grade
   * - Updates aiScore + aiFeedback JSON on HomeworkSubmission
   */
  static async gradeSubmission(
    submissionId: string
  ): Promise<GradingResult> {
    const agent = await getOrCreateGraderAgent();

    const task = await prisma.agentTask.create({
      data: {
        agentId: agent.id,
        taskType: "HOMEWORK_GRADE",
        status: "running",
        input: { submissionId },
      },
    });

    const started = Date.now();

    try {
      // Load submission with related homework + student info
      const submission = await prisma.homeworkSubmission.findUnique({
        where: { id: submissionId },
        include: {
          Homework: true,
          Student: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!submission) {
        throw new Error(`HomeworkSubmission ${submissionId} not found`);
      }

      const homework = submission.Homework;
      if (!homework) {
        throw new Error(
          `HomeworkSubmission ${submissionId} has no related Homework`
        );
      }

      const student = submission.Student;
      const studentName = student?.user?.name ?? "Student";

      const questions = (homework.questions as any[]) ?? [];
      const answers = (submission.answers as any[]) ?? [];

      // Build a JSON payload for the model
      const payload = {
        homework: {
          title: homework.title,
          instructions: homework.instructions ?? "",
          questions,
        },
        submission: {
          studentName,
          answers,
        },
      };

      // Ask the model to grade
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a strict but fair homework grader for middle and high school students. You must return ONLY valid JSON, no extra text.",
          },
          {
            role: "user",
            content: [
              "Grade this homework. Use this exact JSON shape:",
              "",
              `{
  "overallScore": number,          // 0-100
  "overallFeedback": string,       // short summary for the student
  "questions": [
    {
      "questionIndex": number,     // index of the question in the array
      "score": number,             // score for this question (0-1 or 0-10 is fine)
      "maxScore": number,          // max score for this question
      "feedback": string           // short explanation of what they did well or should fix
    }
  ]
}`,
              "",
              "Important: Return ONLY JSON. No backticks, no explanation, no prose. Here is the data:",
              JSON.stringify(payload, null, 2),
            ].join("\n"),
          },
        ],
        temperature: 0.2,
        max_tokens: 800,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";

      let parsed: GradingResult;
      try {
        parsed = JSON.parse(raw) as GradingResult;
      } catch (err) {
        console.error("Failed to parse grading JSON:", raw);
        throw new Error("Model returned invalid JSON for grading.");
      }

      // Basic sanity checks
      if (
        typeof parsed.overallScore !== "number" ||
        !Array.isArray(parsed.questions)
      ) {
        throw new Error("Grading result missing expected fields.");
      }

      // Save back to DB
      const updated = await prisma.homeworkSubmission.update({
        where: { id: submissionId },
        data: {
          aiScore: parsed.overallScore,
          aiFeedback: parsed,
        },
      });

      const durationMs = Date.now() - started;

      // Mark task as completed
      await prisma.agentTask.update({
        where: { id: task.id },
        data: {
          status: "completed",
          output: {
            submissionId,
            aiScore: parsed.overallScore,
          },
          durationMs,
          completedAt: new Date(),
        },
      });

      // Update simple metrics snapshot
      await prisma.agentMetric.create({
        data: {
          agentId: agent.id,
          tasksCompleted: 1,
          tasksFailed: 0,
          avgDurationMs: durationMs,
          successRate: 1,
        },
      });

      // Also mark Agent lastRunAt
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: "idle",
          lastRunAt: new Date(),
        },
      });

      return parsed;
    } catch (error: any) {
      console.error("HomeworkGrader error:", error);

      const durationMs = Date.now() - started;

      // Task failed
      await prisma.agentTask.update({
        where: { id: task.id },
        data: {
          status: "failed",
          error: error?.message ?? String(error),
          durationMs,
          completedAt: new Date(),
        },
      });

      await prisma.agentMetric.create({
        data: {
          agentId: agent.id,
          tasksCompleted: 0,
          tasksFailed: 1,
          avgDurationMs: durationMs,
          successRate: 0,
        },
      });

      await prisma.systemEvent.create({
        data: {
          eventType: "HOMEWORK_GRADE_ERROR",
          severity: "error",
          source: "HomeworkGrader",
          message: "Failed to grade homework submission",
          metadata: { submissionId, error: error?.message ?? String(error) },
        },
      });

      throw error;
    }
  }
}

// Optional helper if you prefer a function-style import
export async function gradeHomeworkSubmission(
  submissionId: string
): Promise<GradingResult> {
  return HomeworkGrader.gradeSubmission(submissionId);
}

