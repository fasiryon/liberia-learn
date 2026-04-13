// app/api/track/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  eventType: z.string().min(1).max(80),
  sessionId: z.string().optional().nullable(),
  contentId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    let user;
    try {
      user = await requireUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: true }); // analytics must never break UX
    }

    const { eventType, sessionId, contentId, metadata } = parsed.data;

    const details = {
      sessionId: sessionId ?? null,
      contentId: contentId ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
      ...(metadata ?? {}),
    };

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: eventType,
      resourceType: "track_event",
      resourceId: contentId ?? undefined,
      details,
    });

    await logLearningEvent({
      schoolId: user.schoolId ?? null,
      userId: user.id,
      actor: {
        type: "user",
        id: user.id,
        role: user.role ?? null,
      },
      target: contentId
        ? {
            type: "curriculum_content",
            id: contentId,
          }
        : null,
      eventType,
      source: "/api/track",
      contentId: contentId ?? null,
      clientEventId: sessionId ?? null,
      metadata: details,
      qualityMarkers: {
        ingestion: "user_telemetry",
      },
    });
  } catch (_) {
    // analytics must never break the user experience
  }

  return NextResponse.json({ ok: true });
}
