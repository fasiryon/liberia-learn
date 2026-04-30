import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { assignLessonToSlot } from "@/lib/timetable/timetableService";

function metadataOf(action: any): Record<string, any> {
  return action?.metadata && typeof action.metadata === "object" ? { ...action.metadata } : {};
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function bindLessonPlanToSlot(input: {
  planId: string;
  slotId: string;
  teacherUserId: string;
  schoolId: string;
}) {
  const plan = await (prisma as any).teacherAction.findFirst({
    where: {
      id: input.planId,
      teacherUserId: input.teacherUserId,
      schoolId: input.schoolId,
      actionType: "lesson_plan_saved",
    },
  });
  if (!plan) throw Object.assign(new Error("Lesson plan not found"), { status: 404 });

  const metadata = metadataOf(plan);
  const lessonTitle = typeof metadata.lessonTitle === "string" ? metadata.lessonTitle : "Saved lesson plan";
  const plannedDate =
    typeof metadata.plannedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metadata.plannedDate)
      ? metadata.plannedDate
      : dateOnly(new Date());

  const scheduledWork = await prisma.scheduledWork.findFirst({
    where: {
      id: input.slotId,
      class: { schoolId: input.schoolId, teacherId: input.teacherUserId },
    },
    select: { id: true, classId: true, scheduledDate: true, contentId: true },
  });

  if (scheduledWork) {
    await (prisma as any).teacherAction.update({
      where: { id: plan.id },
      data: {
        classId: scheduledWork.classId,
        contentId: plan.contentId ?? scheduledWork.contentId,
        metadata: {
          ...metadata,
          bindingStatus: "bound",
          scheduledWorkId: scheduledWork.id,
          plannedDate: dateOnly(scheduledWork.scheduledDate),
          slotType: "scheduled_work",
          slotId: scheduledWork.id,
        },
      },
    });

    await logAudit({
      userId: input.teacherUserId,
      schoolId: input.schoolId,
      action: "teacher.lesson_plan.bound",
      resourceType: "teacher_action",
      resourceId: plan.id,
      details: { slotType: "scheduled_work", scheduledWorkId: scheduledWork.id },
    });

    return { ok: true, bindingStatus: "bound", slotType: "scheduled_work", slotId: scheduledWork.id };
  }

  const timetable = await prisma.timetable.findFirst({
    where: { id: input.slotId, schoolId: input.schoolId, teacherId: input.teacherUserId },
    select: { id: true, classId: true, periodLabel: true },
  });

  if (!timetable) {
    await (prisma as any).teacherAction.update({
      where: { id: plan.id },
      data: { metadata: { ...metadata, bindingStatus: "needs_review", slotId: input.slotId } },
    });
    return { ok: true, bindingStatus: "needs_review", slotType: null, slotId: input.slotId };
  }

  const assignment = await assignLessonToSlot(timetable.id, input.teacherUserId, input.schoolId, {
    assignedDate: new Date(`${plannedDate}T00:00:00.000Z`),
    title: lessonTitle,
    curriculumContentId: plan.contentId ?? null,
    instructions: "Teacher lesson plan is attached for this timetable slot.",
  });

  await (prisma as any).teacherAction.update({
    where: { id: plan.id },
    data: {
      classId: timetable.classId,
      metadata: {
        ...metadata,
        bindingStatus: "bound",
        timetableId: timetable.id,
        timetableAssignmentId: assignment.id,
        plannedDate,
        slotType: "timetable",
        slotId: timetable.id,
      },
    },
  });

  await logAudit({
    userId: input.teacherUserId,
    schoolId: input.schoolId,
    action: "teacher.lesson_plan.bound",
    resourceType: "teacher_action",
    resourceId: plan.id,
    details: { slotType: "timetable", timetableId: timetable.id, timetableAssignmentId: assignment.id },
  });

  await logLearningEvent({
    schoolId: input.schoolId,
    userId: input.teacherUserId,
    contentId: plan.contentId ?? undefined,
    eventType: "teacher.lesson_plan.bound",
    source: "/api/teacher/lesson-plan/bind",
    actor: { type: "user", id: input.teacherUserId, role: "TEACHER" },
    target: { type: "teacher_action", id: plan.id },
    metadata: { slotType: "timetable", timetableId: timetable.id, timetableAssignmentId: assignment.id },
  }).catch(() => null);

  return { ok: true, bindingStatus: "bound", slotType: "timetable", slotId: timetable.id, timetableAssignmentId: assignment.id };
}
