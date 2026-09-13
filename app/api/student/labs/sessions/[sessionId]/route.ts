import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=record; authority=student-session-ownership; rationale=lab observations require matching learner and school ownership
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";
import { enqueue } from "@/lib/offline/offlineQueue";

export const dynamic = "force-dynamic";

/** Client lab scores are provisional observations and never update mastery. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("STUDENT");
    const { sessionId } = params;
    const session = await prisma.labSession.findUnique({ where: { id: sessionId } });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.studentId !== user.id || session.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { observations, conclusions, score, completedAt } = body;
    if (score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100)) {
      return NextResponse.json({ error: "Invalid provisional score" }, { status: 400 });
    }

    const isCompleting = Boolean(completedAt) && score != null;
    const updated = await prisma.labSession.update({
      where: { id: sessionId },
      data: {
        observations: observations !== undefined ? observations : undefined,
        conclusions: conclusions !== undefined ? conclusions : undefined,
        score: score !== undefined ? score : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        masteryUpdated: false,
      },
    });

    await logAudit({
      userId: user.id,
      action: isCompleting ? "lab.session.complete.provisional" : "lab.session.update",
      resourceType: "labSession",
      resourceId: sessionId,
      schoolId: session.schoolId,
      details: { provisionalScore: score ?? null, isCompleting, masteryUpdated: false },
    });

    try {
      enqueue("lab.session.update", sessionId, {
        userId: user.id,
        provisionalScore: score ?? null,
        isCompleting,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // The durable browser outbox is best-effort for an already persisted row.
    }

    return NextResponse.json({
      session: updated,
      evidenceStatus: isCompleting ? "PROVISIONAL" : "RAW_OBSERVATION",
      masteryUpdated: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update session" },
      { status: err?.status ?? 500 }
    );
  }
}
