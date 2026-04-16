import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getTeacherClassInsightsResponse } from "@/lib/ai/teacher/classInsights";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildTeacherClassPerformance } from "@/lib/reporting/teacherClassPerformance";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";

const BodySchema = z.object({
  classId: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    const user = await requireRole("TEACHER");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/teacher/class-insights",
      schoolId: user.schoolId,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const body = BodySchema.parse(await req.json());
    const cls = await prisma.class.findFirst({
      where: {
        id: body.classId,
        schoolId: user.schoolId,
        teacherId: user.id,
      },
      select: { id: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const performance = await buildTeacherClassPerformance(user.id, user.schoolId);
    const classPerformance = performance.find((entry) => entry.classId === body.classId);
    if (!classPerformance) {
      return NextResponse.json({ error: "Class performance not found" }, { status: 404 });
    }

    const result = await getTeacherClassInsightsResponse(classPerformance, {
      route: "/api/teacher/class-insights",
      schoolId: user.schoolId,
      userId: user.id,
      classId: classPerformance.classId,
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "ai.teacher.class_insights.requested",
      resourceType: "teacher_class_insights",
      resourceId: classPerformance.classId,
      traceId,
      details: {
        className: classPerformance.className,
        subject: classPerformance.subject,
        hadFallback: result.hadFallback,
      },
    });

    return NextResponse.json(result, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate class insights" },
      { status: error?.status ?? 500 }
    );
  }
}
