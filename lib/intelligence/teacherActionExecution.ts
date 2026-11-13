import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { getTeacherLessonPlannerResponse } from "@/lib/ai/teacher/lessonPlanner";
import { openInterventionChain } from "@/lib/interventions/interventionChains";
import { authorizeClassAccess, type ClassFunction } from "@/lib/authz/classAuthority";

export type TeacherActionLifecycle = "draft" | "confirmed" | "executed" | "failed";

type ExecutionContext = {
  teacherUserId: string;
  schoolId: string;
  /** The caller's role (TEACHER or ADMIN), for the class-authority decision. */
  role?: string;
};

type ExecutionResult = {
  actionId: string;
  status: TeacherActionLifecycle;
  handler: string;
  resourceType: string | null;
  resourceId: string | null;
  message: string;
};

function metadataOf(action: any): Record<string, any> {
  return action?.metadata && typeof action.metadata === "object" ? { ...action.metadata } : {};
}

function baseActionType(actionType: string) {
  return actionType.startsWith("teacher_alert.") ? actionType.slice("teacher_alert.".length) : actionType;
}

function dueTomorrow() {
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 1);
  due.setUTCHours(23, 59, 0, 0);
  return due;
}

async function updateLifecycle(actionId: string, metadata: Record<string, any>, status: TeacherActionLifecycle, extra: Record<string, any> = {}) {
  await (prisma as any).teacherAction.update({
    where: { id: actionId },
    data: {
      metadata: {
        ...metadata,
        lifecycle: status,
        ...extra,
      },
    },
  });
}

const forbidden = () => Object.assign(new Error("Forbidden"), { status: 403 });
const HANDLED_TYPES = ["ASSIGN_REMEDIATION_REVIEW", "PLAN_CLASS_REVIEW", "GENERATE_REVIEW_PLAN", "CREATE_FOLLOW_UP_REMINDER", "RECORD_FOLLOW_UP", "REVIEW_INTERVENTION"];

/** The student's current classes in this school (Student.id). */
async function studentClassIds(studentId: string, schoolId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({ where: { studentId, Class: { schoolId } }, select: { classId: true } });
  return Array.from(new Set(rows.map((row) => row.classId)));
}

/** The first candidate class on which the caller currently holds `fn` (with `subject`), or null. */
async function firstAuthorizedClass(context: ExecutionContext, candidates: readonly (string | null | undefined)[], fn: ClassFunction, subject?: string | null) {
  const actor = { id: context.teacherUserId, role: (context.role ?? "TEACHER") as "TEACHER", schoolId: context.schoolId };
  for (const classId of Array.from(new Set(candidates.filter((id): id is string => typeof id === "string" && id.length > 0)))) {
    if ((await authorizeClassAccess(actor, { classId, subject: subject ?? undefined, fn })).allowed) return classId;
  }
  return null;
}

/**
 * AT-GRADE-01 batch 3 (CoS ruling 10, COS-BATCH3-RULINGS-20261028 B): every handler is authorized through
 * lib/authz/classAuthority with its own target class and function, on CURRENT authority, before any write (including the
 * lifecycle update). Returns the authorized class (null only for an owner-only reminder); throws 403 or 409 otherwise.
 */
async function authorizeTeacherAction(action: any, metadata: Record<string, any>, context: ExecutionContext): Promise<string | null> {
  const type = baseActionType(action.actionType);
  if (!HANDLED_TYPES.includes(type)) throw Object.assign(new Error("No execution handler exists for this action."), { status: 409 });
  const metadataClassId = typeof metadata?.action?.targetClassId === "string" ? metadata.action.targetClassId : null;
  const studentClasses = action.studentId ? await studentClassIds(action.studentId, context.schoolId) : [];
  let classId: string | null = null;
  if (type === "ASSIGN_REMEDIATION_REVIEW") {
    classId = await firstAuthorizedClass(context, [action.classId, metadataClassId, ...studentClasses], "class.lesson.support", action.subject);
  } else if (type === "PLAN_CLASS_REVIEW" || type === "GENERATE_REVIEW_PLAN") {
    if (!action.classId) throw forbidden();
    classId = await firstAuthorizedClass(context, [action.classId], "class.lesson.support", action.subject);
  } else if (type === "CREATE_FOLLOW_UP_REMINDER") {
    // With neither a class nor a student, the reminder is the caller's own note (owner-only; the action is the caller's).
    if (!action.classId && !action.studentId) return null;
    classId = await firstAuthorizedClass(context, action.classId ? [action.classId] : studentClasses, "class.read.learning", action.subject);
  } else {
    if (!action.studentId) throw Object.assign(new Error("Intervention action needs a target student."), { status: 409 });
    classId = await firstAuthorizedClass(context, studentClasses, "class.feedback", action.subject);
  }
  if (!classId) throw forbidden();
  return classId;
}

function targetStudentIdsForAction(action: any, metadata: Record<string, any>) {
  const fromMetadata = Array.isArray(metadata?.action?.targetStudents)
    ? metadata.action.targetStudents.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const ids = [...fromMetadata];
  if (action.studentId && !ids.includes(action.studentId)) ids.push(action.studentId);
  return [...new Set(ids)];
}

async function resolveTargetStudents(action: any, classId: string, targetStudentIds: string[]) {
  if (targetStudentIds.length === 0) {
    return { validTargetStudentIds: [], invalidTargetStudentIds: [] };
  }

  const students = await prisma.student.findMany({
    where: {
      id: { in: targetStudentIds },
      user: { schoolId: action.schoolId },
      enrollments: { some: { classId } },
    },
    select: { id: true },
  });
  const validTargetStudentIds = students.map((student) => student.id);
  const validSet = new Set(validTargetStudentIds);
  return {
    validTargetStudentIds,
    invalidTargetStudentIds: targetStudentIds.filter((id) => !validSet.has(id)),
  };
}

async function executeRemediationAssignment(action: any, metadata: Record<string, any>, authorizedClassId: string) {
  if (!action.contentId) {
    throw Object.assign(new Error("Remediation action needs linked curriculum content."), { status: 409 });
  }
  // The class was decided by authorizeTeacherAction (class.lesson.support); never re-derived from Class.teacherId.
  const cls = await prisma.class.findUnique({ where: { id: authorizedClassId }, select: { id: true, name: true } });
  if (!cls) {
    throw Object.assign(new Error("Remediation action needs a teacher-owned class."), { status: 409 });
  }

  const content = await prisma.curriculumContent.findUnique({
    where: { contentId: action.contentId },
    select: { contentId: true, payload: true, moeAlignments: true },
  });
  if (!content) {
    throw Object.assign(new Error("Linked curriculum content was not found."), { status: 404 });
  }
  const lessonTitle = (content.payload as any)?.title ?? action.contentId;
  const requestedTargetStudentIds = targetStudentIdsForAction(action, metadata);
  const { validTargetStudentIds, invalidTargetStudentIds } = await resolveTargetStudents(action, cls.id, requestedTargetStudentIds);
  if (requestedTargetStudentIds.length > 0 && validTargetStudentIds.length === 0) {
    throw Object.assign(new Error("Remediation action needs at least one target student in the class."), { status: 409 });
  }

  const assignment = await prisma.assignment.create({
    data: {
      classId: cls.id,
      title: `Remediation review: ${lessonTitle}`,
      description:
        "Teacher-confirmed remediation assignment generated from an alert. Review the linked lesson, complete the practice, and be ready for a short check-in.",
      dueAt: dueTomorrow(),
      points: 100,
      contentId: action.contentId,
      generationMethod: "suggested",
      moeStandardCodes: Array.isArray(content.moeAlignments)
        ? (content.moeAlignments as Array<{ code?: string }>).map((row) => row.code).filter((code): code is string => Boolean(code))
        : [],
    },
  });

  if (validTargetStudentIds.length > 0) {
    await prisma.assignmentSubmission.createMany({
      data: validTargetStudentIds.map((studentId) => ({
        assignmentId: assignment.id,
        studentId,
      })),
      skipDuplicates: true,
    });

    await (prisma as any).teacherAction?.create?.({
      data: {
        teacherUserId: action.teacherUserId,
        schoolId: action.schoolId,
        classId: cls.id,
        contentId: action.contentId,
        actionType: "assignment_targeting",
        targetType: "assignment",
        targetId: assignment.id,
        subject: action.subject ?? undefined,
        metadata: {
          sourceActionId: action.id,
          targetStudentIds: validTargetStudentIds,
          invalidTargetStudentIds,
          targetingMode: "student_visibility",
        },
      },
    });
  }

  return {
    handler: "ASSIGN_REMEDIATION_REVIEW",
    resourceType: "assignment",
    resourceId: assignment.id,
    message:
      validTargetStudentIds.length > 0
        ? `Created targeted remediation assignment for ${validTargetStudentIds.length} student${validTargetStudentIds.length === 1 ? "" : "s"} in ${cls.name}.`
        : `Created remediation assignment for ${cls.name}.`,
  };
}

async function executeReviewPlan(action: any, metadata: Record<string, any>) {
  const alertEvidence = String(metadata?.action?.evidence ?? metadata?.alertType ?? "Teacher alert");
  const subject = action.subject ?? "GENERAL";
  const title = baseActionType(action.actionType) === "PLAN_CLASS_REVIEW" ? "Class review plan" : "Targeted review plan";
  const planner = await getTeacherLessonPlannerResponse(
    {
      lessonTitle: title,
      lessonContent: `Use this teacher alert evidence to prepare a short review plan: ${alertEvidence}`,
      subject,
      gradeLevel: 7,
      classSize: 35,
      timeAvailableMinutes: 45,
      specialConsiderations: "Teacher must review and adapt before using with students.",
    },
    {
      route: "/api/teacher/actions/execute",
      schoolId: action.schoolId,
      userId: action.teacherUserId,
      contentId: action.contentId ?? null,
    }
  );

  const savedPlan = await (prisma as any).teacherAction.create({
    data: {
      teacherUserId: action.teacherUserId,
      schoolId: action.schoolId,
      classId: action.classId ?? undefined,
      contentId: action.contentId ?? undefined,
      actionType: "lesson_plan_saved",
      targetType: "teacher_action",
      targetId: action.id,
      subject,
      metadata: {
        lifecycle: "draft",
        sourceActionId: action.id,
        lessonTitle: title,
        gradeLevel: 7,
        plannedDate: null,
        weekStart: null,
        plan: planner,
      },
    },
  });

  return {
    handler: baseActionType(action.actionType),
    resourceType: "teacher_action",
    resourceId: savedPlan.id,
    message: "Saved a teacher-reviewable plan draft.",
  };
}

async function executeReminder(action: any, metadata: Record<string, any>) {
  const reminder = await (prisma as any).teacherAction.create({
    data: {
      teacherUserId: action.teacherUserId,
      schoolId: action.schoolId,
      classId: action.classId ?? undefined,
      studentId: action.studentId ?? undefined,
      contentId: action.contentId ?? undefined,
      actionType: "teacher_reminder",
      targetType: "teacher_action",
      targetId: action.id,
      subject: action.subject ?? undefined,
      metadata: {
        lifecycle: "executed",
        reminderType: "follow_up",
        sourceActionId: action.id,
        reason: metadata?.action?.evidence ?? "Teacher alert follow-up",
      },
    },
  });
  return {
    handler: "CREATE_FOLLOW_UP_REMINDER",
    resourceType: "teacher_action",
    resourceId: reminder.id,
    message: "Created teacher follow-up reminder.",
  };
}

async function executeInterventionTracking(action: any, metadata: Record<string, any>) {
  if (!action.studentId) {
    throw Object.assign(new Error("Intervention action needs a target student."), { status: 409 });
  }

  await (prisma as any).interventionRecommendation.updateMany({
    where: {
      schoolId: action.schoolId,
      studentId: action.studentId,
      status: { in: ["pending", "ACTIVE", "IN_PROGRESS"] },
    },
    data: { status: "actioned" },
  });

  const chain = await openInterventionChain({
    schoolId: action.schoolId,
    studentId: action.studentId,
    teacherUserId: action.teacherUserId,
    openedByUserId: action.teacherUserId,
    openedByRole: "TEACHER",
    attributionSource: "teacher_alert.action_execution",
    rationale: metadata?.action?.evidence ?? "Teacher confirmed alert follow-up.",
    metadata: { sourceActionId: action.id, alertType: metadata?.alertType ?? null },
  });

  return {
    handler: baseActionType(action.actionType),
    resourceType: "intervention_chain",
    resourceId: chain.id,
    message: "Recorded teacher follow-up in intervention tracking.",
  };
}

export async function executeTeacherAction(
  actionId: string,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const action = await (prisma as any).teacherAction.findFirst({
    where: { id: actionId, teacherUserId: context.teacherUserId, schoolId: context.schoolId },
  });
  if (!action) throw Object.assign(new Error("Action not found"), { status: 404 });

  const metadata = metadataOf(action);
  const safeStatus = metadata?.action?.status;
  if (safeStatus === "unsupported") {
    throw Object.assign(new Error("This action is unsupported."), { status: 409 });
  }

  // Authorization comes first: nothing, not even the lifecycle update, is written for an unauthorized action.
  const authorizedClassId = await authorizeTeacherAction(action, metadata, context);

  await updateLifecycle(action.id, metadata, "confirmed", { confirmedAt: new Date().toISOString() });

  try {
    const type = baseActionType(action.actionType);
    const result =
      type === "ASSIGN_REMEDIATION_REVIEW"
        ? await executeRemediationAssignment(action, metadata, authorizedClassId!)
        : type === "PLAN_CLASS_REVIEW" || type === "GENERATE_REVIEW_PLAN"
          ? await executeReviewPlan(action, metadata)
          : type === "CREATE_FOLLOW_UP_REMINDER"
            ? await executeReminder(action, metadata)
            : type === "RECORD_FOLLOW_UP" || type === "REVIEW_INTERVENTION"
              ? await executeInterventionTracking(action, metadata)
              : null;

    if (!result) {
      throw Object.assign(new Error("No execution handler exists for this action."), { status: 409 });
    }

    await updateLifecycle(action.id, metadata, "executed", {
      confirmedAt: metadata.confirmedAt ?? new Date().toISOString(),
      executedAt: new Date().toISOString(),
      executionResult: result,
    });

    await logAudit({
      userId: context.teacherUserId,
      schoolId: context.schoolId,
      action: "teacher.action.executed",
      resourceType: "teacher_action",
      resourceId: action.id,
      details: { actionType: action.actionType, handler: result.handler, resourceType: result.resourceType, resourceId: result.resourceId },
    });

    await logLearningEvent({
      schoolId: context.schoolId,
      userId: context.teacherUserId,
      studentId: action.studentId ?? undefined,
      contentId: action.contentId ?? undefined,
      eventType: "teacher.action.executed",
      source: "/api/teacher/actions/execute",
      actor: { type: "user", id: context.teacherUserId, role: "TEACHER" },
      target: { type: "teacher_action", id: action.id },
      metadata: { actionType: action.actionType, handler: result.handler, resourceType: result.resourceType, resourceId: result.resourceId },
    }).catch(() => null);

    return { actionId: action.id, status: "executed", ...result };
  } catch (error: any) {
    await updateLifecycle(action.id, metadata, "failed", {
      failedAt: new Date().toISOString(),
      failureReason: error?.message ?? "Action execution failed",
    });
    throw error;
  }
}
