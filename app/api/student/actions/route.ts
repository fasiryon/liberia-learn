import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveStudentAction, dismissStudentAction } from "@/lib/intelligence/actionEngine";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const user = await requireRole("STUDENT");
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const body = await request.json();
    const { actionId, action, reason } = body as {
      actionId: string;
      action: "resolved" | "dismissed";
      reason?: string;
    };

    if (!actionId || !action) {
      return NextResponse.json({ error: "actionId and action required" }, { status: 400 });
    }

    // Verify this action belongs to this student
    const rec = await prisma.interventionRecommendation.findFirst({
      where: { id: actionId, studentId: student.id },
      select: { id: true },
    });
    if (!rec) return NextResponse.json({ error: "Action not found" }, { status: 404 });

    if (action === "resolved") {
      await resolveStudentAction(actionId, user.id);
    } else if (action === "dismissed") {
      await dismissStudentAction(actionId, user.id, reason);
    } else {
      return NextResponse.json({ error: "action must be 'resolved' or 'dismissed'" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
