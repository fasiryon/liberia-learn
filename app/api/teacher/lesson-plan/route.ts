import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getTeacherLessonPlannerResponse } from "@/lib/ai/teacher/lessonPlanner";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { recordMetricEvent } from "@/lib/metrics/events";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { isTeacherAiPlanningEnabled } from "@/lib/serverFlags";

const LessonPlanSchema = z.object({
  action: z.literal("generate").optional(),
  lessonTitle: z.string().trim().min(3).max(200),
  lessonContent: z.string().trim().min(20).max(20000),
  subject: z.string().trim().min(2).max(60),
  gradeLevel: z.number().int().min(1).max(12),
  classSize: z.number().int().min(1).max(300),
  timeAvailableMinutes: z.union([
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90),
  ]),
  specialConsiderations: z.string().trim().max(500).optional(),
  contentId: z.string().trim().min(1).max(200).optional(),
});

const SaveLessonPlanSchema = z.object({
  action: z.literal("save"),
  contentId: z.string().trim().min(1).max(200),
  classId: z.string().trim().min(1).max(200).optional(),
  scheduledWorkId: z.string().trim().min(1).max(200).optional(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lessonTitle: z.string().trim().min(3).max(200),
  subject: z.string().trim().min(2).max(60),
  gradeLevel: z.number().int().min(1).max(12),
  plan: z.object({
    learningObjectives: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
    warmUpActivity: z.string().trim().min(1).max(2000),
    teachingSequence: z.array(z.object({
      segment: z.string().trim().min(1).max(200),
      minutes: z.number().int().min(1).max(180),
      teacherMoves: z.string().trim().min(1).max(2000),
      studentExperience: z.string().trim().min(1).max(2000),
    })).min(1).max(12),
    assessmentCheck: z.string().trim().min(1).max(2000),
    homeworkSuggestion: z.string().trim().min(1).max(2000),
    hadFallback: z.boolean().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    if (!isTeacherAiPlanningEnabled()) {
      return NextResponse.json({ error: "teacher_ai_planning_disabled" }, { status: 404 });
    }

    const user = await requireRole("TEACHER");
    const rawBody = await req.json();
    if (rawBody?.action === "save") {
      const body = SaveLessonPlanSchema.parse(rawBody);
      if (body.contentId) {
        const content = await prisma.curriculumContent.findUnique({
          where: { contentId: body.contentId },
          select: { contentId: true },
        });
        if (!content) {
          return NextResponse.json({ error: "Curriculum content not found" }, { status: 404 });
        }
      }
      if (body.classId) {
        const cls = await prisma.class.findFirst({
          where: { id: body.classId, schoolId: user.schoolId ?? "", teacherId: user.id },
          select: { id: true },
        });
        if (!cls) {
          return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }
      }
      if (body.scheduledWorkId) {
        const scheduledWork = await prisma.scheduledWork.findFirst({
          where: {
            id: body.scheduledWorkId,
            contentId: body.contentId,
            class: { schoolId: user.schoolId ?? "", teacherId: user.id },
          },
          select: { id: true, classId: true, scheduledDate: true },
        });
        if (!scheduledWork) {
          return NextResponse.json({ error: "Scheduled lesson not found" }, { status: 404 });
        }
      }

      const teacherAction = await (prisma as any).teacherAction.create({
        data: {
          teacherUserId: user.id,
          schoolId: user.schoolId ?? "",
          classId: body.classId,
          contentId: body.contentId,
          actionType: "lesson_plan_saved",
          targetType: "curriculum_content",
          targetId: body.contentId,
          subject: body.subject,
          metadata: {
            lessonTitle: body.lessonTitle,
            gradeLevel: body.gradeLevel,
            scheduledWorkId: body.scheduledWorkId ?? null,
            plannedDate: body.plannedDate ?? null,
            weekStart: body.weekStart ?? null,
            bindingStatus: body.scheduledWorkId ? "bound" : "needs_review",
            slotType: body.scheduledWorkId ? "scheduled_work" : null,
            slotId: body.scheduledWorkId ?? null,
            plan: body.plan,
          },
        },
      });

      await logAudit({
        userId: user.id,
        action: "ai.teacher.lesson_plan.saved",
        resourceType: "ai_teacher_lesson_plan",
        resourceId: body.contentId,
        schoolId: user.schoolId ?? null,
        traceId,
        details: {
          subject: body.subject,
          gradeLevel: body.gradeLevel,
          classId: body.classId ?? null,
          scheduledWorkId: body.scheduledWorkId ?? null,
          plannedDate: body.plannedDate ?? null,
          stepCount: body.plan.teachingSequence.length,
          hadFallback: body.plan.hadFallback === true,
        },
      });

      await logLearningEvent({
        schoolId: user.schoolId ?? null,
        userId: user.id,
        eventType: "teacher.lesson_plan.saved",
        source: "/api/teacher/lesson-plan",
        actor: { type: "user", id: user.id, role: user.role },
        target: { type: "curriculum_content", id: body.contentId },
        contentId: body.contentId,
        subject: body.subject,
        metadata: {
          gradeLevel: body.gradeLevel,
          classId: body.classId ?? null,
          scheduledWorkId: body.scheduledWorkId ?? null,
          plannedDate: body.plannedDate ?? null,
          stepCount: body.plan.teachingSequence.length,
        },
      }).catch(() => null);

      return NextResponse.json({ ok: true, savedPlanId: teacherAction.id });
    }

    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/teacher/lesson-plan",
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const body = LessonPlanSchema.parse(rawBody);
    const plannerInput = {
      lessonTitle: body.lessonTitle,
      lessonContent: body.lessonContent,
      subject: body.subject,
      gradeLevel: body.gradeLevel,
      classSize: body.classSize,
      timeAvailableMinutes: body.timeAvailableMinutes,
      specialConsiderations: body.specialConsiderations,
    } as const;
    const result = await getTeacherLessonPlannerResponse(plannerInput, {
      route: "/api/teacher/lesson-plan",
      schoolId: user.schoolId ?? null,
      userId: user.id,
      contentId: body.contentId ?? null,
    });

    await logAudit({
      userId: user.id,
      action: "ai.teacher.lesson_plan.requested",
      resourceType: "ai_teacher_lesson_plan",
      resourceId: body.contentId ?? body.lessonTitle,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        subject: plannerInput.subject,
        gradeLevel: plannerInput.gradeLevel,
        classSize: plannerInput.classSize,
        timeAvailableMinutes: plannerInput.timeAvailableMinutes,
        hadFallback: result.hadFallback,
      },
    });

    recordMetricEvent(
      result.hadFallback
        ? "ai_teacher_lesson_plan_fallback"
        : "ai_teacher_lesson_plan_request",
      {
        subject: plannerInput.subject,
        gradeLevel: plannerInput.gradeLevel,
        timeAvailableMinutes: plannerInput.timeAvailableMinutes,
      },
      {
        scope: "school",
        scopeId: user.schoolId ?? null,
        schoolId: user.schoolId ?? null,
      }
    ).catch(() => {});

    return NextResponse.json(
      {
        learningObjectives: result.learningObjectives,
        warmUpActivity: result.warmUpActivity,
        teachingSequence: result.teachingSequence,
        assessmentCheck: result.assessmentCheck,
        homeworkSuggestion: result.homeworkSuggestion,
        hadFallback: result.hadFallback,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
