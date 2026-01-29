// lib/ai/tutor-agent.ts
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Simple message type so we don't fight the SDK types
type ChatMessageParam = {
  role: "system" | "user" | "assistant";
  content: string;
};

interface TutorResponse {
  message: string;
  conversationId: string;
  success: boolean;
  error?: string;
}

export class TutorAgent {
  private studentId: string;
  private agentId: string;

  constructor(studentId: string) {
    this.studentId = studentId;
    this.agentId = "tutor-agent-1"; // can make dynamic later
  }

  async chat(userMessage: string): Promise<TutorResponse> {
    const startTime = Date.now();

    try {
      logger.info("TutorAgent received message", {
        studentId: this.studentId,
        messageLength: userMessage.length,
      });

      const history = await this.getConversationHistory();

      const systemPrompt = this.buildSystemPrompt();
      const messages = this.buildMessages(history, userMessage, systemPrompt);

      // Create agent task record
      const task = await prisma.agentTask.create({
        data: {
          agentId: this.agentId,
          taskType: "chat_response",
          status: "running",
          input: {
            studentId: this.studentId,
            message: userMessage,
            historyLength: history.length,
          },
        },
      });

      // Call OpenAI (ChatGPT)
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini", // cheap + strong; swap later if you want
        messages,
        max_tokens: 512,
      });

      const aiMessage =
        completion.choices[0]?.message?.content ??
        "I'm not sure how to answer that.";

      const duration = Date.now() - startTime;

      const tokensUsed =
        (completion.usage?.prompt_tokens ?? 0) +
        (completion.usage?.completion_tokens ?? 0);

      // Mark task completed
      await prisma.agentTask.update({
        where: { id: task.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          durationMs: duration,
          output: {
            response: aiMessage,
            tokensUsed,
          },
        },
      });

      // Save conversation messages
      await this.saveMessages(userMessage, aiMessage);

      // Update metrics
      await this.updateMetrics(true, duration);

      logger.info("TutorAgent completed successfully", {
        studentId: this.studentId,
        duration,
        tokensUsed,
      });

      return {
        message: aiMessage,
        conversationId: task.id,
        success: true,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error("TutorAgent failed", {
        studentId: this.studentId,
        error: error?.message ?? String(error),
        duration,
      });

      await this.updateMetrics(false, duration);

      return {
        message:
          "I'm having trouble right now. Please try again in a moment.",
        conversationId: "",
        success: false,
        error: error?.message ?? String(error),
      };
    }
  }

  // ---------- Helpers ----------

  private buildSystemPrompt(): string {
    return `You are a helpful educational tutor for LiberiaLearn, an AI-powered learning platform serving students in Liberia.

Your role:
- Help students with their homework and classwork
- Explain concepts clearly and patiently
- Use simple, accessible language appropriate for Grade 6-12 students
- Be encouraging and supportive
- If a student is struggling, break down problems into smaller steps
- Relate concepts to real-world examples when possible

Guidelines:
- Keep responses concise (2-3 paragraphs maximum)
- Ask clarifying questions if needed
- Never do the homework FOR the student - guide them to the answer
- Be culturally aware (Liberian context)
- If you don't know something, admit it honestly

Current student context:
- Grade level: 6
- Primary subject: Mathematics
- Learning environment: Low-bandwidth, classroom setting`;
  }

  private buildMessages(
    history: any[],
    newMessage: string,
    systemPrompt: string
  ): ChatMessageParam[] {
    const messages: ChatMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
    ];

    // last 10 messages from history
    for (const msg of history.slice(-10)) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    messages.push({
      role: "user",
      content: newMessage,
    });

    return messages;
  }

  private async getConversationHistory() {
    // If you haven't added ChatMessage model yet, you'll need to add it
    return prisma.chatMessage.findMany({
      where: { studentId: this.studentId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
  }

  private async saveMessages(userMessage: string, aiMessage: string) {
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
          content: aiMessage,
          agentId: this.agentId,
        },
      ],
    });
  }

  private async updateMetrics(success: boolean, duration: number) {
    // Ensure agent exists
    await prisma.agent.upsert({
      where: { id: this.agentId },
      update: { lastRunAt: new Date() },
      create: {
        id: this.agentId,
        name: "TutorAgent",
        type: "educational",
        status: "active",
        lastRunAt: new Date(),
      },
    });

    // Today bucket
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metric = await prisma.agentMetric.findFirst({
      where: {
        agentId: this.agentId,
        timestamp: { gte: today },
      },
    });

    if (metric) {
      const newCompleted = metric.tasksCompleted + (success ? 1 : 0);
      const newFailed = metric.tasksFailed + (success ? 0 : 1);
      const total = newCompleted + newFailed;

      const newAvgDuration = Math.round(
        (metric.avgDurationMs * metric.tasksCompleted + duration) /
          (metric.tasksCompleted + 1)
      );

      await prisma.agentMetric.update({
        where: { id: metric.id },
        data: {
          tasksCompleted: newCompleted,
          tasksFailed: newFailed,
          avgDurationMs: newAvgDuration,
          successRate: total > 0 ? (newCompleted / total) * 100 : 0,
        },
      });
    } else {
      await prisma.agentMetric.create({
        data: {
          agentId: this.agentId,
          tasksCompleted: success ? 1 : 0,
          tasksFailed: success ? 0 : 1,
          avgDurationMs: duration,
          successRate: success ? 100 : 0,
        },
      });
    }
  }
}
