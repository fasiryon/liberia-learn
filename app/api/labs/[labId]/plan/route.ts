import { NextRequest, NextResponse } from "next/server";

import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { planLabAction } from "@/lib/labs/ai/planLabAction";
import { isValidLabId } from "@/lib/labs/registry";
import { validateLabAction } from "@/lib/labs/runtime/validateLabAction";
import type { LabAction } from "@/lib/labs/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { labId: string } }
) {
  if (!isAiLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("STUDENT");
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: `/api/labs/${params.labId}/plan`,
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    if (!isValidLabId(params.labId)) {
      return NextResponse.json({ error: "Unknown lab" }, { status: 404 });
    }

    const body = await req.json();
    const currentState = body?.state ?? body?.currentState ?? {};
    const studentRequest = String(body?.message ?? body?.studentRequest ?? "").trim();

    if (studentRequest.length < 2) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const planned = await planLabAction({
      labId: params.labId,
      currentState,
      studentRequest,
      userId: user.id,
      studentId: user.id,
      schoolId: user.schoolId ?? null,
      lessonId: typeof body?.lessonId === "string" ? body.lessonId : null,
      route: "/api/labs/[labId]/plan",
    });

    let ok = false;
    let responsePlanned = planned;

    if (!planned.rejected && planned.action) {
      const validation = validateLabAction(
        params.labId,
        currentState,
        planned.action as LabAction
      );
      ok = validation.ok;
      if (!validation.ok) {
        responsePlanned = {
          ...planned,
          rejected: true,
          userFacingMessage: validation.reason ?? "That lab action is outside the allowed range.",
          reason: validation.reason ?? "validation_failed",
        };
      }
    }

    await logLearningEvent({
      schoolId: user.schoolId ?? null,
      userId: user.id,
      studentId: user.id,
      actor: { type: "user", id: user.id, role: "STUDENT" },
      target: { type: "ai_lab", id: params.labId },
      eventType: "lab.ai_action.planned",
      source: "/api/labs/[labId]/plan",
      lessonId: typeof body?.lessonId === "string" ? body.lessonId : null,
      metadata: {
        labId: params.labId,
        actionType: responsePlanned.actionType ?? responsePlanned.action?.type ?? null,
        rejected: responsePlanned.rejected,
      },
    });

    return NextResponse.json(
      { ok, planned: responsePlanned },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to plan lab action" },
      { status: error?.status ?? 500 }
    );
  }
}
