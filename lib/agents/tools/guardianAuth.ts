import { prisma } from "@/lib/db";
import type { ToolContext } from "@/lib/agents/types";

/**
 * Authorization check shared by every guardian.* tool: does the caller
 * (ctx.userId) have a StudentGuardian link to studentId? This assumes
 * ctx.userId already reflects a resolved, trusted identity - the SMS-side
 * question of how an inbound phone number maps to a guardian's User.id is a
 * separate, still-pending concern (docs/agents/GUARDIAN_IDENTITY_VERIFICATION.md).
 */
export async function assertGuardianOf(ctx: ToolContext, studentId: string): Promise<void> {
  if (ctx.grantedStudentIds?.includes(studentId)) return;

  if (!ctx.userId) {
    throw Object.assign(new Error("Caller is not a verified guardian."), { status: 401 });
  }
  const link = await prisma.studentGuardian.findUnique({
    where: { studentId_guardianId: { studentId, guardianId: ctx.userId } },
  });
  if (!link) {
    throw Object.assign(new Error("Caller is not a verified guardian of this student."), {
      status: 403,
    });
  }
}
