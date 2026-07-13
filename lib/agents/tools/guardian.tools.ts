import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerTool } from "@/lib/agents/toolRegistry";
import { assertGuardianOf } from "@/lib/agents/tools/guardianAuth";
import { composeGuardianDigest, mostRecentWeekWindow } from "@/lib/notifications/guardianDigest";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";
import { sendPushToUser } from "@/lib/push/sendPush";
import { getTeacherAlertPref } from "@/lib/alert-prefs";
import { logAudit } from "@/lib/audit";
import { enqueueEscalation } from "@/lib/agents/escalation";
import { createInboxNotification } from "@/lib/notifications/inboxService";
import type { ToolDefinition } from "@/lib/agents/types";

const SUBJECTS = [
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "ENGLISH",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
] as const;
type SubjectEnum = (typeof SUBJECTS)[number];
function asSubject(s?: string | null): SubjectEnum | undefined {
  const up = s?.toUpperCase();
  return (SUBJECTS as readonly string[]).includes(up ?? "") ? (up as SubjectEnum) : undefined;
}

// ─── guardian.getStudentProgress ────────────────────────────────────────────

const getStudentProgressInput = z.object({
  studentId: z.string(),
  subject: z.string().optional(),
});
const getStudentProgressOutput = z.object({
  mastery: z.array(
    z.object({ subject: z.string(), strandKey: z.string(), currentScore: z.number(), masteryState: z.string() })
  ),
  recentCompletions: z.array(
    z.object({ title: z.string().nullable(), subject: z.string().nullable(), completedAt: z.string().nullable() })
  ),
  upcomingWork: z.array(
    z.object({ title: z.string(), subject: z.string().nullable(), dueDate: z.string().nullable(), status: z.string() })
  ),
  attendanceRate: z.number().nullable(),
  currentGrade: z.number().nullable(),
});

async function fetchUpcomingWork(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classId: true, Class: { select: { subject: true } } },
  });
  const classIds = enrollments.map((e) => e.classId);
  const classSubject = new Map(enrollments.map((e) => [e.classId, e.Class.subject as string]));
  if (!classIds.length) return [];

  const now = new Date();
  const [assignments, homework] = await Promise.all([
    prisma.assignment.findMany({
      where: { classId: { in: classIds }, dueAt: { gte: now } },
      select: { title: true, classId: true, dueAt: true, submissions: { where: { studentId }, select: { turnedInAt: true } } },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    prisma.homework.findMany({
      where: { classId: { in: classIds }, dueAt: { gte: now } },
      select: { title: true, classId: true, dueAt: true, submissions: { where: { studentId }, select: { submittedAt: true } } },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
  ]);

  const fromAssignments = assignments.map((a) => ({
    title: a.title,
    subject: classSubject.get(a.classId) ?? null,
    dueDate: a.dueAt?.toISOString() ?? null,
    status: a.submissions[0]?.turnedInAt ? "submitted" : "pending",
  }));
  const fromHomework = homework.map((h) => ({
    title: h.title,
    subject: classSubject.get(h.classId) ?? null,
    dueDate: h.dueAt?.toISOString() ?? null,
    status: h.submissions[0]?.submittedAt ? "submitted" : "pending",
  }));
  return [...fromAssignments, ...fromHomework].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export const getStudentProgressTool: ToolDefinition<
  z.infer<typeof getStudentProgressInput>,
  z.infer<typeof getStudentProgressOutput>
> = {
  name: "guardian.getStudentProgress",
  description: "Get a student's mastery, recent completions, upcoming work, attendance rate, and grade.",
  domain: "guardian",
  inputSchema: getStudentProgressInput,
  outputSchema: getStudentProgressOutput,
  auditTag: "agent.tool.guardian.getStudentProgress",
  estimatedCostUnits: 3,
  requiresAuth: ["guardian", "system"],
  handler: async (input, ctx) => {
    await assertGuardianOf(ctx, input.studentId);
    const subject = asSubject(input.subject);

    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { userId: true, currentGrade: true },
    });
    if (!student) throw Object.assign(new Error("Student not found."), { status: 404 });

    const [masteryRows, recent, upcomingWork, attendance] = await Promise.all([
      prisma.studentMasteryProfile.findMany({
        where: { studentId: input.studentId, ...(subject ? { subject } : {}) },
        select: { subject: true, strandKey: true, currentScore: true, masteryState: true },
        take: 20,
      }),
      prisma.studentProgress.findMany({
        where: { studentId: student.userId, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 5,
        select: { completedAt: true, scheduledWork: { select: { content: { select: { title: true, subject: true } } } } },
      }),
      fetchUpcomingWork(input.studentId),
      prisma.attendance.findMany({
        where: { studentId: input.studentId, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { status: true },
      }),
    ]);

    const attendanceRate = attendance.length
      ? attendance.filter((a) => a.status === "PRESENT").length / attendance.length
      : null;

    return {
      mastery: masteryRows.map((m) => ({
        subject: m.subject,
        strandKey: m.strandKey,
        currentScore: m.currentScore,
        masteryState: m.masteryState,
      })),
      recentCompletions: recent.map((r) => ({
        title: r.scheduledWork?.content?.title ?? null,
        subject: r.scheduledWork?.content?.subject ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
      upcomingWork,
      attendanceRate,
      currentGrade: student.currentGrade,
    };
  },
};
registerTool(getStudentProgressTool);

// ─── guardian.getRecentActivity ─────────────────────────────────────────────

const getRecentActivityInput = z.object({ studentId: z.string(), days: z.number().int().positive().max(90) });
const getRecentActivityOutput = z.object({
  lessons: z.array(z.object({ title: z.string().nullable(), subject: z.string().nullable(), completedAt: z.string().nullable() })),
  assignments: z.array(z.object({ title: z.string(), score: z.number().nullable(), submittedAt: z.string().nullable() })),
  completions: z.array(z.object({ title: z.string(), score: z.number().nullable(), submittedAt: z.string() })),
});

export const getRecentActivityTool: ToolDefinition<
  z.infer<typeof getRecentActivityInput>,
  z.infer<typeof getRecentActivityOutput>
> = {
  name: "guardian.getRecentActivity",
  description: "Get a student's lessons, assignment submissions, and homework completions in the last N days.",
  domain: "guardian",
  inputSchema: getRecentActivityInput,
  outputSchema: getRecentActivityOutput,
  auditTag: "agent.tool.guardian.getRecentActivity",
  estimatedCostUnits: 3,
  requiresAuth: ["guardian", "system"],
  handler: async (input, ctx) => {
    await assertGuardianOf(ctx, input.studentId);
    const student = await prisma.student.findUnique({ where: { id: input.studentId }, select: { userId: true } });
    if (!student) throw Object.assign(new Error("Student not found."), { status: 404 });

    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

    const [lessons, assignmentSubs, homeworkSubs] = await Promise.all([
      prisma.studentProgress.findMany({
        where: { studentId: student.userId, completedAt: { gte: since } },
        orderBy: { completedAt: "desc" },
        take: 20,
        select: { completedAt: true, scheduledWork: { select: { content: { select: { title: true, subject: true } } } } },
      }),
      prisma.assignmentSubmission.findMany({
        where: { studentId: input.studentId, turnedInAt: { gte: since } },
        orderBy: { turnedInAt: "desc" },
        take: 20,
        select: { turnedInAt: true, score: true, Assignment: { select: { title: true } } },
      }),
      prisma.homeworkSubmission.findMany({
        where: { studentId: input.studentId, submittedAt: { gte: since } },
        orderBy: { submittedAt: "desc" },
        take: 20,
        select: { submittedAt: true, aiScore: true, teacherScore: true, Homework: { select: { title: true } } },
      }),
    ]);

    return {
      lessons: lessons.map((l) => ({
        title: l.scheduledWork?.content?.title ?? null,
        subject: l.scheduledWork?.content?.subject ?? null,
        completedAt: l.completedAt?.toISOString() ?? null,
      })),
      assignments: assignmentSubs.map((a) => ({
        title: a.Assignment.title,
        score: a.score,
        submittedAt: a.turnedInAt?.toISOString() ?? null,
      })),
      completions: homeworkSubs.map((h) => ({
        title: h.Homework.title,
        score: h.teacherScore ?? h.aiScore ?? null,
        submittedAt: h.submittedAt.toISOString(),
      })),
    };
  },
};
registerTool(getRecentActivityTool);

// ─── guardian.getUpcomingWork ───────────────────────────────────────────────

const getUpcomingWorkInput = z.object({ studentId: z.string() });
const getUpcomingWorkOutput = z.object({
  assignments: z.array(
    z.object({ title: z.string(), subject: z.string().nullable(), dueDate: z.string().nullable(), status: z.string() })
  ),
});

export const getUpcomingWorkTool: ToolDefinition<
  z.infer<typeof getUpcomingWorkInput>,
  z.infer<typeof getUpcomingWorkOutput>
> = {
  name: "guardian.getUpcomingWork",
  description: "Get a student's upcoming assignments and homework, with submission status.",
  domain: "guardian",
  inputSchema: getUpcomingWorkInput,
  outputSchema: getUpcomingWorkOutput,
  auditTag: "agent.tool.guardian.getUpcomingWork",
  estimatedCostUnits: 2,
  requiresAuth: ["guardian", "system"],
  handler: async (input, ctx) => {
    await assertGuardianOf(ctx, input.studentId);
    return { assignments: await fetchUpcomingWork(input.studentId) };
  },
};
registerTool(getUpcomingWorkTool);

// ─── guardian.getTeacherContact ─────────────────────────────────────────────

const getTeacherContactInput = z.object({ studentId: z.string(), subject: z.string().optional() });
const getTeacherContactOutput = z.object({
  teachers: z.array(z.object({ name: z.string().nullable(), subject: z.string(), phone: z.string().optional(), email: z.string().optional() })),
});

export const getTeacherContactTool: ToolDefinition<
  z.infer<typeof getTeacherContactInput>,
  z.infer<typeof getTeacherContactOutput>
> = {
  name: "guardian.getTeacherContact",
  description: "Get the name and contact info for a student's teacher(s), optionally filtered by subject.",
  domain: "guardian",
  inputSchema: getTeacherContactInput,
  outputSchema: getTeacherContactOutput,
  auditTag: "agent.tool.guardian.getTeacherContact",
  estimatedCostUnits: 2,
  requiresAuth: ["guardian", "system"],
  handler: async (input, ctx) => {
    await assertGuardianOf(ctx, input.studentId);
    const subject = asSubject(input.subject);

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: input.studentId, ...(subject ? { Class: { subject } } : {}) },
      select: { Class: { select: { subject: true, teacherId: true, Teacher: { select: { name: true, email: true } } } } },
    });

    const seen = new Set<string>();
    const teachers: { name: string | null; subject: string; phone?: string; email?: string }[] = [];
    for (const e of enrollments) {
      if (!e.Class.teacherId) continue;
      const key = `${e.Class.teacherId}:${e.Class.subject}`;
      if (seen.has(key)) continue;
      seen.add(key);
      teachers.push({
        name: e.Class.Teacher?.name ?? null,
        subject: e.Class.subject,
        email: e.Class.Teacher?.email ?? undefined,
      });
    }
    return { teachers };
  },
};
registerTool(getTeacherContactTool);

// ─── guardian.triggerDigestNow ──────────────────────────────────────────────

const triggerDigestNowInput = z.object({ guardianId: z.string() });
const triggerDigestNowOutput = z.object({ messageId: z.string().nullable(), deliveryStatus: z.string() });

export const triggerDigestNowTool: ToolDefinition<
  z.infer<typeof triggerDigestNowInput>,
  z.infer<typeof triggerDigestNowOutput>
> = {
  name: "guardian.triggerDigestNow",
  description: "Send the guardian's standard weekly digest immediately, via SMS.",
  domain: "guardian",
  inputSchema: triggerDigestNowInput,
  outputSchema: triggerDigestNowOutput,
  auditTag: "agent.tool.guardian.triggerDigestNow",
  estimatedCostUnits: 3,
  requiresAuth: ["guardian", "system"],
  handler: async (input, ctx) => {
    if (!ctx.userId || ctx.userId !== input.guardianId) {
      throw Object.assign(new Error("Caller may only trigger their own digest."), { status: 403 });
    }

    const guardian = await prisma.user.findUnique({
      where: { id: input.guardianId },
      select: { guardianOf: { select: { studentId: true } } },
    });
    if (!guardian) throw Object.assign(new Error("Guardian not found."), { status: 404 });
    const studentIds = guardian.guardianOf.map((sg) => sg.studentId);

    const { weekStart, weekEnd } = mostRecentWeekWindow(new Date());
    const result = await composeGuardianDigest({ guardianId: input.guardianId, studentIds, weekStart, weekEnd });
    if (!result) return { messageId: null, deliveryStatus: "skipped" };

    const idempotencyKey = `weekly-digest-agent:${input.guardianId}:${weekStart.toISOString().slice(0, 10)}:${Date.now()}`;
    const sendResult = await sendGuardianSMS(
      {
        schoolId: result.schoolId,
        studentId: result.primaryStudentId,
        guardianId: input.guardianId,
        messageType: "weekly_digest",
        payload: { ...result.metrics, studentName: result.studentFirstName, actionTip: result.metrics.actionTip },
        idempotencyKey,
      },
      { throttlePolicy: { enabled: false } }
    );

    return { messageId: sendResult.deliveryLogId ?? null, deliveryStatus: sendResult.status };
  },
};
registerTool(triggerDigestNowTool);

// ─── guardian.flagForTeacher ────────────────────────────────────────────────

const flagForTeacherInput = z.object({ studentId: z.string(), message: z.string().min(1).max(1000), teacherId: z.string().optional() });
const flagForTeacherOutput = z.object({ messageId: z.string(), deliveryStatus: z.string() });

export const flagForTeacherTool: ToolDefinition<
  z.infer<typeof flagForTeacherInput>,
  z.infer<typeof flagForTeacherOutput>
> = {
  name: "guardian.flagForTeacher",
  description: "Send a message from the guardian to the student's teacher.",
  domain: "guardian",
  inputSchema: flagForTeacherInput,
  outputSchema: flagForTeacherOutput,
  auditTag: "agent.tool.guardian.flagForTeacher",
  estimatedCostUnits: 2,
  requiresAuth: ["guardian", "system"],
  handler: async (input, ctx) => {
    await assertGuardianOf(ctx, input.studentId);

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: input.studentId,
        ...(input.teacherId ? { Class: { teacherId: input.teacherId } } : { Class: { teacherId: { not: null } } }),
      },
      select: { Class: { select: { schoolId: true, teacherId: true } } },
    });
    if (!enrollment?.Class.teacherId) {
      throw Object.assign(new Error("No teacher found for this student."), { status: 404 });
    }

    const message = await prisma.guardianMessage.create({
      data: {
        guardianId: ctx.userId!,
        teacherId: enrollment.Class.teacherId,
        studentId: input.studentId,
        schoolId: enrollment.Class.schoolId,
        fromRole: "guardian",
        body: input.message,
      },
    });

    void logAudit({
      userId: ctx.userId,
      action: "guardian.message.sent",
      resourceType: "guardian_message",
      resourceId: message.id,
      schoolId: enrollment.Class.schoolId,
      traceId: ctx.traceId ?? null,
    });

    try {
      const pref = await getTeacherAlertPref(enrollment.Class.teacherId);
      if (pref.alertGuardianMessage) {
        await sendPushToUser(enrollment.Class.teacherId, {
          title: "New message",
          body: input.message.length > 80 ? input.message.slice(0, 77) + "..." : input.message,
          url: "/teacher/messages",
        });
      }
    } catch {
      // Best-effort push; the persisted GuardianMessage is the source of truth.
    }

    return { messageId: message.id, deliveryStatus: "delivered" };
  },
};
registerTool(flagForTeacherTool);

// ─── guardian.requestPhoneUpdate ────────────────────────────────────────────

const requestPhoneUpdateInput = z.object({ reason: z.string().min(1).max(500) });
const requestPhoneUpdateOutput = z.object({ escalationId: z.string() });

/**
 * Sprint 6.1, GUARDIAN_PHONE_UPDATE.md (approved): the agent never updates
 * User.guardianPhoneE164 itself - a challenge-based per-conversation
 * verification (Deliverable 5 option (a)) proves "knows this student's ID
 * and name," not "is the specific guardian whose number is on file," so
 * letting it rewrite the identity anchor would be a privilege escalation.
 * This only flags the request for a human (principal/admin) to act on with
 * an audit trail. Requires a resolved, known-number identity (ctx.userId) -
 * a challenge-only grant has no User.id to attach the request to.
 */
export const requestPhoneUpdateTool: ToolDefinition<
  z.infer<typeof requestPhoneUpdateInput>,
  z.infer<typeof requestPhoneUpdateOutput>
> = {
  name: "guardian.requestPhoneUpdate",
  description: "Flag a guardian's phone-number-change request for the school to action. Never updates the number directly.",
  domain: "guardian",
  inputSchema: requestPhoneUpdateInput,
  outputSchema: requestPhoneUpdateOutput,
  auditTag: "agent.tool.guardian.requestPhoneUpdate",
  estimatedCostUnits: 1,
  requiresAuth: ["guardian", "system"],
  handler: async (input, ctx) => {
    if (!ctx.userId) {
      throw Object.assign(new Error("Phone-update requests require a resolved guardian identity."), { status: 401 });
    }

    const guardian = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        guardianOf: { take: 1, select: { student: { select: { user: { select: { schoolId: true } } } } } },
      },
    });
    const schoolId = guardian?.guardianOf[0]?.student.user.schoolId ?? null;

    const { id: escalationId } = await enqueueEscalation({
      agentName: "liberialearn-family",
      invocationId: null,
      userId: ctx.userId,
      reason: `guardian phone-update request: ${input.reason}`,
      priority: "LOW",
      traceId: ctx.traceId ?? null,
      schoolId,
    });

    if (schoolId) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", schoolId }, select: { id: true } });
      await Promise.all(
        admins.map((a) =>
          createInboxNotification(a.id, {
            title: "Guardian phone-update request",
            body: `A guardian requested a phone number update: ${input.reason}`.slice(0, 200),
            type: "guardian_phone_update",
          })
        )
      );
    }

    return { escalationId };
  },
};
registerTool(requestPhoneUpdateTool);
