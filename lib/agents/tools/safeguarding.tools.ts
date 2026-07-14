import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerTool } from "@/lib/agents/toolRegistry";
import { enqueueEscalation } from "@/lib/agents/escalation";
import { notifySchoolSafeguarding } from "@/lib/agents/safeguarding/notify";
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
 * safeguarding concern, never merely because the guardian asked for an
 * escalation (see lib/agents/prompts/liberialearn-family.md). This is the
 * LLM-judgment path, a secondary catch-all for concerns the deterministic
 * keyword gate (lib/agents/safeguarding/keywordGate.ts, run before the LLM
 * loop in lib/agents/sms/guardianInbound.ts) doesn't anticipate.
 *
 * This writes the EscalationQueue row (invocationId nullable because this
 * fires mid-loop before the enclosing AgentInvocation is persisted) and
 * notifies the school via notifySchoolSafeguarding - ADMIN-role users at the
 * student's school plus School.designatedSafetyStaffUserId, if set (Sprint
 * 6.1 Spec 5, approved). Priority is not forced to HIGH here (the caller
 * passes it); the deterministic keyword-gate path always uses HIGH.
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
    let schoolId = ctx.schoolId ?? null;
    if (!schoolId) {
      const student = await prisma.student.findUnique({
        where: { id: input.studentId },
        select: { user: { select: { schoolId: true } } },
      });
      schoolId = student?.user.schoolId ?? null;
    }

    const { id } = await enqueueEscalation({
      agentName: ctx.agentName,
      invocationId: null,
      userId: ctx.userId ?? null,
      reason: `safeguarding: ${input.reason} (studentId=${input.studentId})`,
      priority: input.priority,
      traceId: ctx.traceId ?? null,
      schoolId,
    });

    if (schoolId) {
      await notifySchoolSafeguarding(schoolId, `Guardian message flagged for safeguarding review (escalation ${id}).`);
    }

    return { escalationId: id, assignedTo: null };
  },
};
registerTool(safeguardingEscalateTool);
