import { prisma } from "@/lib/db";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";
import { projectStudentLabPayload } from "@/lib/curriculum/studentLessonProjection";
import { loadStudentClasses, type StudentReaderUser } from "./enrollmentReadModel";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { isLegacyLabId } from "@/lib/learner-experience/labExperience";

/** The assigned student host implements guided practical procedures, not generic 2D/3D simulation payloads. */
export function practicalRuntimeAvailable(lab: { labType: string; payload: unknown }) {
  const payload = projectStudentLabPayload(lab.payload);
  return lab.labType === "guided_walkthrough" && Array.isArray(payload.procedure) && payload.procedure.length > 0 &&
    payload.procedure.every((step) => !!step && typeof (step as { instruction?: unknown }).instruction === "string" &&
      Boolean((step as { instruction: string }).instruction.trim()));
}

/** Shared by discovery, detail and mutation routes. Session existence alone never grants class access. */
export async function loadAuthorizedPracticalSessions(user: StudentReaderUser, filter: { labId?: string; sessionId?: string } = {}) {
  if (!user.schoolId || !isVirtualLabsEnabled()) return [];
  const classIds = (await loadStudentClasses(user)).map((c) => c.classId);
  if (!classIds.length) return [];
  const sessions = await prisma.labSession.findMany({ where: { studentId: user.id, schoolId: user.schoolId,
    ...(filter.labId ? { labId: filter.labId } : {}), ...(filter.sessionId ? { id: filter.sessionId } : {}) },
    select: { id: true, labId: true, scheduledWorkId: true, startedAt: true, completedAt: true },
    orderBy: [{ startedAt: "desc" }, { id: "asc" }], take: 200 });
  const [labs, scheduled] = await Promise.all([
    prisma.virtualLab.findMany({ where: { labId: { in: sessions.map((s) => s.labId) }, status: "published",
      OR: [{ schoolId: null }, { schoolId: user.schoolId }] },
      select: { labId: true, title: true, subject: true, estimatedMinutes: true, labType: true, payload: true } }),
    prisma.scheduledWork.findMany({ where: { id: { in: sessions.flatMap((s) => s.scheduledWorkId ? [s.scheduledWorkId] : []) },
      classId: { in: classIds }, class: { schoolId: user.schoolId },
      OR: [{ status: null }, { status: "confirmed" }] }, select: { id: true } }),
  ]);
  const allowedWork = new Set(scheduled.map((s) => s.id));
  return sessions.flatMap((session) => {
    const lab = labs.find((l) => l.labId === session.labId);
    return (!filter.sessionId || session.id === filter.sessionId) && (!filter.labId || session.labId === filter.labId) &&
      !getInteractiveLabDefinition(session.labId) && !isLegacyLabId(session.labId) && session.scheduledWorkId && allowedWork.has(session.scheduledWorkId) && lab && practicalRuntimeAvailable(lab)
      ? [{ session, lab }] : [];
  });
}

export function studentSessionSummary(session: { id: string; labId: string; startedAt: Date; completedAt: Date | null }) {
  return { id: session.id, labId: session.labId, startedAt: session.startedAt, completedAt: session.completedAt };
}
