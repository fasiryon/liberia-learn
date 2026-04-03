/**
 * POST /api/teacher/assist
 *
 * Teacher Support Assistant returns reinforcement suggestions for a class.
 * No individual student data in prompt, response, or audit log.
 *
 * Feature flag : AI_TEACHER_ASSIST_ENABLED (default OFF -> 404)
 * Auth         : TEACHER role required
 * Rate limit   : 50 requests/hour via checkAiRateLimit()
 * Budget check : centralized routed AI budget guards with graceful fallback
 *
 * Audit action : "ai.teacher.assist.requested"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { isAiTeacherAssistEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { recordMetricEvent } from "@/lib/metrics/events";
import {
  getTeacherAssistResponse,
  type TeacherAssistInput,
} from "@/lib/ai/teacher/teacherAssist";

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    if (!isAiTeacherAssistEnabled()) {
      return NextResponse.json(
        { error: "ai_teacher_assist_disabled" },
        { status: 404 }
      );
    }

    const user = await requireRole("TEACHER");
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/teacher/assist",
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const body = await req.json();
    const subject = String(body.subject ?? "").trim();
    const strandKey = String(body.strandKey ?? "").trim();

    if (!subject || !strandKey) {
      return NextResponse.json(
        { error: "subject and strandKey are required" },
        { status: 400 }
      );
    }

    const weakStrandKeys: string[] = Array.isArray(body.weakStrandKeys)
      ? (body.weakStrandKeys as unknown[])
          .filter((value): value is string => typeof value === "string")
          .slice(0, 10)
      : [];

    const input: TeacherAssistInput = {
      subject,
      strandKey,
      classAverageMasteryState: String(
        body.classAverageMasteryState ?? "DEVELOPING"
      ),
      weakStrandKeys,
      gradeBand: String(body.gradeBand ?? "lower_primary"),
    };

    const result = await getTeacherAssistResponse(input, {
      route: "/api/teacher/assist",
      schoolId: user.schoolId ?? null,
      userId: user.id,
    });

    await logAudit({
      userId: user.id,
      action: "ai.teacher.assist.requested",
      resourceType: "ai_teacher_assist",
      schoolId: user.schoolId,
      traceId,
      details: {
        subject: input.subject,
        strandKey: input.strandKey,
        classAverageMasteryState: input.classAverageMasteryState,
        weakStrandCount: weakStrandKeys.length,
        hadFallback: result.hadFallback,
      },
    });

    recordMetricEvent(
      result.hadFallback
        ? "ai_teacher_assist_fallback"
        : "ai_teacher_assist_request",
      {
        subject: input.subject,
        strandKey: input.strandKey,
        gradeBand: input.gradeBand,
        weakStrandCount: weakStrandKeys.length,
      },
      {
        scope: "school",
        scopeId: user.schoolId ?? null,
        schoolId: user.schoolId,
      }
    ).catch(() => {});

    return NextResponse.json(
      {
        reinforcementSuggestions: result.reinforcementSuggestions,
        pacingSuggestion: result.pacingSuggestion,
        resourceHints: result.resourceHints,
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
