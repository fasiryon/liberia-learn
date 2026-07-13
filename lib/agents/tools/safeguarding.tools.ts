import { z } from "zod";
import { registerTool } from "@/lib/agents/toolRegistry";
import { enqueueEscalation } from "@/lib/agents/escalation";
import type { AgentRole, ToolDefinition } from "@/lib/agents/types";

const ALL_ROLES: AgentRole[] = ["student", "teacher", "principal", "guardian", "moe", "admin", "system"];

const escalateInput = z.object({
  studentId: z.string(),
  reason: z.string().min(1),
  priority: z.enum(["HIGH", "MEDIUM"]),
});
const escalateOutput = z.object({
  escalationId: z.string(),
  assignedTo: z.string().nullable(),
});

/**
 * Called only on the calling agent's own judgment that a message describes a
 * safeguarding concern — never merely because the guardian asked for an
 * escalation (see docs/agents/prompts/liberialearn-family.md).
 *
 * This writes the EscalationQueue row (the same mechanism output-moderation
 * escalations already use, invocationId nullable because this fires mid-loop
 * before the enclosing AgentInvocation is persisted). It does NOT yet notify a
 * principal or a support inbox: there is no PRINCIPAL Role in the schema today
 * (Role enum: TEACHER/STUDENT/GUARDIAN/ADMIN/DISTRICT_ADMIN/MOE_*), so "who
 * gets notified, on what channel, within what SLA" is exactly the open
 * question in docs/agents/GUARDIAN_SAFEGUARDING.md — deliberately deferred
 * pending that review.
 */
export const safeguardingEscalateTool: ToolDefinition<
  z.infer<typeof escalateInput>,
  z.infer<typeof escalateOutput>
> = {
  name: "safeguarding.escalate",
  description: "Escalate a safeguarding concern about a student to the human review queue.",
  domain: "system",
  inputSchema: escalateInput,
  outputSchema: escalateOutput,
  auditTag: "agent.tool.safeguarding.escalate",
  estimatedCostUnits: 1,
  requiresAuth: ALL_ROLES,
  handler: async (input, ctx) => {
    const { id } = await enqueueEscalation({
      agentName: ctx.agentName,
      invocationId: null,
      userId: ctx.userId ?? null,
      reason: `safeguarding: ${input.reason} (studentId=${input.studentId})`,
      priority: input.priority,
      traceId: ctx.traceId ?? null,
      schoolId: ctx.schoolId ?? null,
    });
    return { escalationId: id, assignedTo: null };
  },
};
registerTool(safeguardingEscalateTool);
