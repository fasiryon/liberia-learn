import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerTool } from "@/lib/agents/toolRegistry";
import { sendPushToUser } from "@/lib/push/sendPush";
import type { ToolDefinition } from "@/lib/agents/types";

const sendWhisperPromptInput = z.object({
  sessionId: z.string(),
  message: z.string().min(1).max(300),
});
const sendWhisperPromptOutput = z.object({ sent: z.boolean() });

export const teachingSendWhisperPromptTool: ToolDefinition<
  z.infer<typeof sendWhisperPromptInput>,
  z.infer<typeof sendWhisperPromptOutput>
> = {
  name: "teaching.sendWhisperPrompt",
  description:
    "Sends a private, real-time coaching suggestion to the facilitator's own device. Never visible to students. Use for analogies, prompts to check on a specific student or group, or pacing cues.",
  domain: "teacher",
  inputSchema: sendWhisperPromptInput,
  outputSchema: sendWhisperPromptOutput,
  auditTag: "teaching.whisper_sent",
  estimatedCostUnits: 0,
  requiresAuth: ["system"],
  handler: async (input) => {
    const session = await prisma.teachingSession.findUnique({
      where: { id: input.sessionId },
      select: { facilitatorId: true },
    });
    if (!session) return { sent: false };
    const result = await sendPushToUser(session.facilitatorId, {
      title: "Teaching Coach",
      body: input.message,
      url: `/teach/session/${input.sessionId}`,
    });
    return { sent: result.sent > 0 };
  },
};

const flagOutOfScopeInput = z.object({
  sessionId: z.string(),
  question: z.string().min(1).max(500),
});
const flagOutOfScopeOutput = z.object({ logged: z.boolean() });

export const teachingFlagOutOfScopeTool: ToolDefinition<
  z.infer<typeof flagOutOfScopeInput>,
  z.infer<typeof flagOutOfScopeOutput>
> = {
  name: "teaching.flagOutOfScope",
  description:
    "Call this INSTEAD of answering when a question or explanation would go beyond the literal lesson content you were given. This is the required signal for I Don't Know Intelligence in DEFERRED guardrail mode.",
  domain: "teacher",
  inputSchema: flagOutOfScopeInput,
  outputSchema: flagOutOfScopeOutput,
  auditTag: "teaching.out_of_scope_flagged",
  estimatedCostUnits: 0,
  requiresAuth: ["system"],
  handler: async () => {
    return { logged: true };
  },
};

registerTool(teachingSendWhisperPromptTool);
registerTool(teachingFlagOutOfScopeTool);
