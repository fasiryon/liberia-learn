// lib/ai/tutor-agent.ts  (Sprint 2 safe version)
// Changes:
//  1) Constructor accepts grade + subjects (no hardcoded grade/subject)
//  2) Uses chat history from DB
//  3) Telemetry + metrics updates are safe (no divide-by-zero / skew)

import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

interface TutorResponse {
  message: string;
  conversationId: string;
  success: boolean;
  error?: string;
}

export class TutorAgent {
  private readonly studentId: string;
  private readonly grade: number | string;
  private readonly subjects: string;
  private readonly agentId = "tutor-agent";
constructor(studentId: string, grade: number | string = "unknown", subjects = "General") {
    this.studentId = studentId;
    this.grade     = grade;
    this.subjects  = subjects;
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

      const history  = await this.getHistory();
      const messages = this.buildMessages(history, userMessage);

      // Create agent task record
      const task = await prisma.agentTask.create({
        data: {
          agentId:  this.agentId,
          taskType: "chat_response",
          status:   "running",
          input:    { studentId: this.studentId, grade: this.grade, messageLength: userMessage.length },
        },
      });
      taskId = task.id;

      const completion = await openai.chat.completions.create({
        model:      "gpt-4o-mini",
        messages,
        max_tokens: 512,
      });

      const aiMessage =
        completion.choices[0]?.message?.content ?? "I'm not sure how to answer that.";

      const duration   = Date.now() - startTime;
      const tokensUsed =
        (completion.usage?.prompt_tokens ?? 0) + (completion.usage?.completion_tokens ?? 0);

      await prisma.agentTask.update({
        where: { id: taskId },
        data:  {
          status: "completed",
          completedAt: new Date(),
          durationMs: duration,
          output: { response: aiMessage, tokensUsed }
        },
      });

      await this.saveMessages(userMessage, aiMessage);
      await this.updateMetrics(true, duration);

      return { message: aiMessage, conversationId: taskId, success: true };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error("TutorAgent failed", { studentId: this.studentId, error: error?.message });

      if (taskId) {
        await prisma.agentTask
          .update({
            where: { id: taskId },
            data: { status: "failed", completedAt: new Date(), durationMs: duration, error: error?.message }
          })
          .catch(() => {});
      }

      await this.updateMetrics(false, duration);

      return {
        message: "I'm having trouble right now. Please try again in a moment.",
        conversationId: "",
        success: false,
        error: error?.message,
      };
    }
  }


  private buildMessages(history: any[], newMessage: string): ChatMsg[] {
    return [
      { role: "system", content: this.systemPrompt() },
      ...history.slice(-10).map((m) => ({
        role:    (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: newMessage },
    ];
  }

  private systemPrompt(): string {
    return `You are a helpful educational tutor for LiberiaLearn, an AI-powered learning platform for students in Liberia.

Student context:
- Grade level: ${this.grade}
- Subject(s): ${this.subjects}
- Learning environment: low-bandwidth classroom

Your role:
- Help with homework and classwork -- guide, do not just give answers.
- Use simple, encouraging language appropriate for Grades 1-12.
- Keep responses concise (2-3 paragraphs max).
- Relate concepts to everyday Liberian contexts where helpful.
- If you are unsure, say so honestly.`;
  }

  private async getHistory() {
    return prisma.chatMessage.findMany({
      where:   { studentId: this.studentId },
      orderBy: { createdAt: "asc" },
      take:    20,
    });
  }

  private async saveMessages(userMsg: string, aiMsg: string) {
    await prisma.chatMessage.createMany({
      data: [
        { studentId: this.studentId, role: "user",      content: userMsg },
        { studentId: this.studentId, role: "assistant", content: aiMsg, agentId: this.agentId },
      ],
    });
  }

  // Safe daily metrics (no divide-by-zero, averages only completed)
  private async updateMetrics(success: boolean, duration: number) {
    await prisma.agent.upsert({
      where:  { id: this.agentId },
      update: { lastRunAt: new Date() },
      create: { id: this.agentId, name: "TutorAgent", type: "educational", status: "active", lastRunAt: new Date() },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metric = await prisma.agentMetric.findFirst({
      where: { agentId: this.agentId, timestamp: { gte: today } },
    });

    if (metric) {
      const newCompleted = metric.tasksCompleted + (success ? 1 : 0);
      const newFailed    = metric.tasksFailed    + (success ? 0 : 1);
      const total        = newCompleted + newFailed;

      const completedForAvg = metric.tasksCompleted + (success ? 1 : 0);
      const newAvgMs = completedForAvg > 0
        ? Math.round((metric.avgDurationMs * metric.tasksCompleted + (success ? duration : 0)) / completedForAvg)
        : metric.avgDurationMs;

      await prisma.agentMetric.update({
        where: { id: metric.id },
        data:  {
          tasksCompleted: newCompleted,
          tasksFailed: newFailed,
          avgDurationMs: newAvgMs,
          successRate: total > 0 ? (newCompleted / total) * 100 : 0,
        },
      });
    } else {
      await prisma.agentMetric.create({
        data: {
          agentId:        this.agentId,
          tasksCompleted: success ? 1 : 0,
          tasksFailed:    success ? 0 : 1,
          avgDurationMs:  success ? duration : 0,
          successRate:    success ? 100 : 0,
        },
      });
    }
  }
}