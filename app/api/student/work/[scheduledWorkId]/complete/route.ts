import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { enqueue } from "@/lib/offline/offlineQueue";
import { completeScheduledLesson } from "@/lib/student/completeScheduledLesson";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ scheduledWorkId: string }> }
) {
  try {
    const user = await requireRole("STUDENT");
    const { scheduledWorkId } = await params;
    const body = await req.json().catch(() => null);
    const result = await completeScheduledLesson({
      user,
      scheduledWorkId,
      exitTicketAnswers: Array.isArray(body?.exitTicketAnswers) ? body.exitTicketAnswers : [],
    });

    // Fire-and-forget: record in offline queue for idempotent sync tracking.
    // Never let queue errors surface to the student.
    try {
      enqueue("lesson.completed", scheduledWorkId, {
        userId: user.id,
        completedAt: (result.completedAt ?? new Date()).toISOString(),
      });
    } catch { /* noop */ }

    return NextResponse.json({ success: true, completedAt: result.completedAt, exitTicketScore: result.exitTicketScore });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
