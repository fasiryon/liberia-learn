/**
 * POST /api/student/tutor
 *
 * Student AI Tutor returns a strand-targeted explanation or practice prompt.
 * No PII in request, response, audit log, or AI prompt.
 *
 * Feature flag : AI_TUTOR_ENABLED (default OFF -> 404)
 * Auth         : Any authenticated session; studentId = session user.id
 * Rate limit   : 20 requests/hour via checkAiRateLimit()
 * Budget check : centralized routed AI budget guards with graceful fallback
 *
 * Audit action : "ai.tutor.requested"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { isAiTutorEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { recordMetricEvent } from "@/lib/metrics/events";
import {
  getStudentTutorResponse,
  isValidRequestType,
  type StudentTutorInput,
} from "@/lib/ai/tutor/studentTutor";
import { recordSloEvent } from "@/lib/slo/tracker";

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  const startedAt = Date.now();

  try {
    if (!isAiTutorEnabled()) {
      return NextResponse.json({ error: "ai_tutor_disabled" }, { status: 404 });
    }

    const user = await requireUser();
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/student/tutor",
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

    const input: StudentTutorInput = {
      subject,
      strandKey,
      masteryState: String(body.masteryState ?? "NOT_ASSESSED"),
      proficiencyState: String(body.proficiencyState ?? "NOT_ASSESSED"),
      gradeBand: String(body.gradeBand ?? "lower_primary"),
      requestType: isValidRequestType(body.requestType)
        ? body.requestType
        : "explain",
    };

    const result = await getStudentTutorResponse(input, {
      route: "/api/student/tutor",
      schoolId: user.schoolId ?? null,
      userId: user.id,
    });

    await logAudit({
      userId: user.id,
      action: "ai.tutor.requested",
      resourceType: "ai_tutor",
      schoolId: user.schoolId,
      traceId,
      details: {
        subject: input.subject,
        strandKey: input.strandKey,
        requestType: input.requestType,
        guidanceLevel: result.guidanceLevel,
        hadFallback: result.hadFallback,
      },
    });

    recordMetricEvent(
      result.hadFallback ? "ai_tutor_fallback" : "ai_tutor_request",
      {
        subject: input.subject,
        strandKey: input.strandKey,
        gradeBand: input.gradeBand,
        requestType: input.requestType,
      },
      {
        scope: "school",
        scopeId: user.schoolId ?? null,
        schoolId: user.schoolId,
      }
    ).catch(() => {});

    recordSloEvent({
      service: "tutor",
      success: true,
      latencyMs: Date.now() - startedAt,
      schoolId: user.schoolId ?? null,
    });

    return NextResponse.json(
      {
        explanation: result.explanation,
        practicePrompt: result.practicePrompt ?? null,
        guidanceLevel: result.guidanceLevel,
        confidenceScore: result.confidenceScore,
        hadFallback: result.hadFallback,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err: any) {
    recordSloEvent({
      service: "tutor",
      success: false,
      latencyMs: Date.now() - startedAt,
      schoolId: null,
    });

    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
