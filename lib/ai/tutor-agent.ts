// lib/ai/tutor-agent.ts
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { routedCompletion } from "@/lib/ai/router";

const AGENT_ID = "tutor-agent";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

interface TutorResponse {
  message: string;
  conversationId: string;
  success: boolean;
  tier?: string;
  error?: string;
}

export class TutorAgent {
  private readonly studentId: string;
  private readonly grade: number | string;
  private readonly subjects: string;

  constructor(
    studentId: string,
    grade: number | string = "unknown",
    subjects = "General"
  ) {
    this.studentId = studentId;
    this.grade = grade;
    this.subjects = subjects;
  }

  async chat(userMessage: string): Promise<TutorResponse> {
    const startTime = Date.now();
    let taskId = "";

    try {
      logger.info("TutorAgent received message", {
        studentId: this.studentId,
        grade: this.grade,
        messageLength: userMessage.length,
      });

      const history = await prisma.chatMessage.findMany({
        where: { studentId: this.studentId },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      const messages: ChatMsg[] = [
        { role: "system", content: this.systemPrompt() },
        ...history.slice(-10).map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as
            | "user"
            | "assistant",
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ];

      // Create agent task record
      const task = await prisma.agentTask.create({
        data: {
          agentId: AGENT_ID,
          taskType: "chat_response",
          status: "running",
          input: {
            studentId: this.studentId,
            grade: this.grade,
            messageLength: userMessage.length,
          },
        },
      });
      taskId = task.id;

      const result = await routedCompletion({ messages, maxTokens: 512 });

      const duration = Date.now() - startTime;

      // Update task with tier/model/cost info
      await prisma.agentTask.update({
        where: { id: taskId },
        data: {
          status: "completed",
          completedAt: new Date(),
          durationMs: duration,
          output: {
            response: result.content,
            tier: result.tier,
            model: result.model,
            costUSD: result.estimatedCostUSD,
          },
        },
      });

      // Save both messages
      await prisma.chatMessage.createMany({
        data: [
          {
            studentId: this.studentId,
            role: "user",
            content: userMessage,
          },
          {
            studentId: this.studentId,
            role: "assistant",
            content: result.content,
            agentId: AGENT_ID,
          },
        ],
      });

      // Upsert Agent record
      await prisma.agent.upsert({
        where: { id: AGENT_ID },
        update: { lastRunAt: new Date() },
        create: {
          id: AGENT_ID,
          name: "TutorAgent",
          type: "educational",
          status: "active",
          lastRunAt: new Date(),
        },
      });

      // Update or create daily AgentMetric
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const metric = await prisma.agentMetric.findFirst({
        where: { agentId: AGENT_ID, timestamp: { gte: today } },
      });

      if (metric) {
        const newCompleted = metric.tasksCompleted + 1;
        const total = newCompleted + metric.tasksFailed;
        const newAvgMs = Math.round(
          (metric.avgDurationMs * metric.tasksCompleted + duration) /
            newCompleted
        );

        await prisma.agentMetric.update({
          where: { id: metric.id },
          data: {
            tasksCompleted: newCompleted,
            avgDurationMs: newAvgMs,
            successRate: total > 0 ? (newCompleted / total) * 100 : 0,
          },
        });
      } else {
        await prisma.agentMetric.create({
          data: {
            agentId: AGENT_ID,
            tasksCompleted: 1,
            tasksFailed: 0,
            avgDurationMs: duration,
            successRate: 100,
          },
        });
      }

      return {
        message: result.content,
        conversationId: taskId,
        success: true,
        tier: result.tier,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error("TutorAgent failed", {
        studentId: this.studentId,
        error: error?.message,
      });

      if (taskId) {
        await prisma.agentTask
          .update({
            where: { id: taskId },
            data: {
              status: "failed",
              completedAt: new Date(),
              durationMs: duration,
              error: error?.message,
            },
          })
          .catch(() => {});
      }

      // Update failed metric
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const metric = await prisma.agentMetric
        .findFirst({
          where: { agentId: AGENT_ID, timestamp: { gte: today } },
        })
        .catch(() => null);

      if (metric) {
        const newFailed = metric.tasksFailed + 1;
        const total = metric.tasksCompleted + newFailed;
        await prisma.agentMetric
          .update({
            where: { id: metric.id },
            data: {
              tasksFailed: newFailed,
              successRate:
                total > 0 ? (metric.tasksCompleted / total) * 100 : 0,
            },
          })
          .catch(() => {});
      } else {
        await prisma.agentMetric
          .create({
            data: {
              agentId: AGENT_ID,
              tasksCompleted: 0,
              tasksFailed: 1,
              avgDurationMs: 0,
              successRate: 0,
            },
          })
          .catch(() => {});
      }

      return {
        message:
          "I'm having trouble right now. Please try again in a moment.",
        conversationId: "",
        success: false,
        error: error?.message,
      };
    }
  }

  private systemPrompt(): string {
    return `You are a helpful educational tutor for LiberiaLearn, an AI-powered learning platform for students in Liberia.

Student context:
- Grade level: ${this.grade}
- Subject(s): ${this.subjects}
- Learning environment: low-bandwidth classroom in Liberia

Your role:
- Help with homework and classwork — guide the student, do not simply give answers.
- Use simple, encouraging language appropriate for the student's grade level.
- Keep responses concise (2-3 paragraphs max).
- Relate concepts to everyday Liberian life and contexts where helpful (e.g., local markets, geography, culture).
- If you are unsure, say so honestly.
- Always be patient, supportive, and culturally aware.`;
  }
}
