// route-policy: auth=session; scope=tenant; authority=canonical-learner-context; rationale=authenticated role and server-resolved published lesson scope constrain tutor access.
/**
 * POST /api/student/tutor
 *
 * Student AI Tutor returns a strand-targeted explanation or practice prompt.
 * No PII in request, response, audit log, or AI prompt.
 *
 * Feature flag : AI_TUTOR_ENABLED (default OFF -> 404)
 * Auth         : STUDENT role required
 * Rate limit   : 20 requests/hour via checkAiRateLimit()
 * Budget check : centralized routed AI budget guards with graceful fallback
 *
 * Audit action : "ai.tutor.requested"
 */
import { z } from "zod";
import { TutorIdentitySchema, TutorActionSchema } from "@/lib/ai/tutor/contextContract";
import { resolveTutorContext } from "@/lib/ai/tutor/tutorContext";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { isAiTutorEnabled, isAiTrustIndicatorsEnabled } from "@/lib/serverFlags";
import { isAiTutorFlagEnabled } from "@/lib/flags";
import { buildTrustSignal } from "@/lib/ai/trust";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { recordMetricEvent } from "@/lib/metrics/events";
import {
  getStudentTutorResponse,
} from "@/lib/ai/tutor/studentTutor";
import { recordSloEvent } from "@/lib/slo/tracker";

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  const startedAt = Date.now();

  try {
    // Primary gate: server-side env var (fail-closed, testable via vi.mock)
    if (!isAiTutorEnabled()) {
      return NextResponse.json({ error: "ai_tutor_disabled" }, { status: 404 });
    }
    // Edge Config kill-switch: can disable instantly without redeploy
    // Defaults ON when Edge Config is unavailable (env var already guards)
    if (!(await isAiTutorFlagEnabled())) {
      return NextResponse.json({ error: "ai_tutor_disabled" }, { status: 404 });
    }

    const user = await requireRole("STUDENT");
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/student/tutor",
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const body = z.object({
      question: z.string().trim().min(1).max(1200),
      focusQuestion: z.string().trim().min(1).max(1200).optional(),
      tutorContext: TutorIdentitySchema.optional(),
      tutorAction: TutorActionSchema.optional(),
      lessonId: z.string().trim().min(1).max(200).optional(),
      contentId: z.string().trim().min(1).max(200).optional(),
      requestType: z.enum(["explain", "practice", "step_by_step", "reinforce", "explain_differently"]).optional(),
    }).parse(await req.json());
    const action = body.tutorAction ?? (body.requestType === "reinforce" ? "explain_differently" : body.requestType ?? "explain");
    const context = await resolveTutorContext(user, body.tutorContext ?? { lessonId: body.lessonId, contentId: body.contentId }, action);
    const result = await getStudentTutorResponse({ context, studentQuestion: body.question, focusQuestion: body.focusQuestion }, {
      route: "/api/student/tutor", userId: user.id,
    });

    await logAudit({
      userId: user.id,
      action: "ai.tutor.requested",
      resourceType: "ai_tutor",
      schoolId: user.schoolId,
      traceId,
      details: {
        subject: context.subject,
        strandKey: context.objectiveIds[0] ?? "unbound",
        requestType: context.action,
        lessonId: context.lesson?.id ?? null,
        contentId: context.lesson?.contentId ?? null,
        resolvedSceneId: context.sceneId,
        resolvedObjectiveIds: context.objectiveIds,
        sourceTiers: context.sources.map((source) => ({ id: source.id, tier: source.tutorTier })),
        groundingStrength: result.groundingStrength,
        fallbackReason: result.fallbackReason,
        guidanceLevel: result.guidanceLevel,
        hadFallback: result.hadFallback,
      },
    });

    recordMetricEvent(
      result.hadFallback ? "ai_tutor_fallback" : "ai_tutor_request",
      {
        subject: context.subject,
        strandKey: context.objectiveIds[0] ?? "unbound",
        gradeBand: String(context.grade),
        requestType: context.action,
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

    const trustSignal = isAiTrustIndicatorsEnabled()
      ? buildTrustSignal({
          groundingScore: result.confidenceScore,
          hadFallback: result.hadFallback,
          retrievalUsed: result.sourcesUsed > 0,
          role: "STUDENT",
        })
      : undefined;

    return NextResponse.json(
      {
        explanation: result.explanation,
        practicePrompt: result.practicePrompt ?? null,
        guidanceLevel: result.guidanceLevel,
        confidenceScore: result.confidenceScore,
        hadFallback: result.hadFallback,
        sources: result.sources,
        tutorContext: result.tutorContext,
        groundingStrength: result.groundingStrength,
        isWeakGrounding: result.isWeakGrounding,
        ...(trustSignal ? { trustSignal } : {}),
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
      { status: err instanceof z.ZodError ? 400 : err?.status ?? 500 }
    );
  }
}
