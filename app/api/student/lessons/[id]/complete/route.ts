import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { completeScheduledLesson } from "@/lib/student/completeScheduledLesson";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const body = await req.json().catch(() => null);
    const result = await completeScheduledLesson({
      user,
      scheduledWorkId: params.id,
      exitTicketAnswers: Array.isArray(body?.exitTicketAnswers) ? body.exitTicketAnswers : [],
    });

    return NextResponse.json({ success: true, completedAt: result.completedAt, exitTicketScore: result.exitTicketScore });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to complete lesson" }, { status: err?.status ?? 500 });
  }
}
