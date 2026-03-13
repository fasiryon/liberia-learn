import crypto from "crypto";
import { answerStudentQuestion } from "@/lib/ai/tutor/studentTutor";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

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
    const studentIdHash = this.hashId(this.studentId);

    try {
      logger.info("TutorAgent received message", {
        studentIdHash,
        grade: this.grade,
        messageLength: userMessage.length,
      });

      const history = await prisma.chatMessage.findMany({
        where: { studentId: this.studentId },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      const conversationHistory: ChatMsg[] = history.slice(-10).map((message) => ({
        role: (message.role === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: message.content,
      }));

      const task = await prisma.agentTask.create({
        data: {
          agentId: AGENT_ID,
          taskType: "chat_response",
          status: "running",
          input: {
            studentIdHash,
            grade: this.grade,
            messageLength: userMessage.length,
          },
        },
      });
      taskId = task.id;

      const responseText = await answerStudentQuestion(
        this.studentId,
        userMessage,
        conversationHistory
      );

      const duration = Date.now() - startTime;

      await prisma.agentTask.update({
        where: { id: taskId },
        data: {
          status: "completed",
          completedAt: new Date(),
          durationMs: duration,
          output: {
            response: responseText,
          },
        },
      });

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
            content: responseText,
            agentId: AGENT_ID,
          },
        ],
      });

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
        message: responseText,
        conversationId: taskId,
        success: true,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error("TutorAgent failed", {
        studentIdHash,
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

  private hashId(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
  }
}
