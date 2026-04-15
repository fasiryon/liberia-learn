import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getTeacherLessonPlannerResponse } from "@/lib/ai/teacher/lessonPlanner";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";

const LessonPlanSchema = z.object({
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

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    const user = await requireRole("TEACHER");
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/teacher/lesson-plan",
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const body = LessonPlanSchema.parse(await req.json());
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
