import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isLessonDeliveryTrackingEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/teacher/schedule/[id]/deliver
 * Part 2: Mark a scheduled lesson as delivered.
 * Body: { deliveredAt?, deliveryNotes?, completionRate?, toolUsageLog? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isLessonDeliveryTrackingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { id } = params;

    const sw = await prisma.scheduledWork.findUnique({
      where: { id },
      include: { class: { select: { schoolId: true } } },
    });

    if (!sw || sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { deliveredAt, deliveryNotes, completionRate, toolUsageLog } = body;

    if (completionRate !== undefined && (completionRate < 0 || completionRate > 100)) {
      return NextResponse.json(
        { error: "completionRate must be between 0 and 100" },
        { status: 400 }
      );
    }

    const updated = await prisma.scheduledWork.update({
      where: { id },
      data: {
        isDelivered: true,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : new Date(),
        deliveryNotes: deliveryNotes ?? undefined,
        completionRate: completionRate ?? undefined,
        toolUsageLog: toolUsageLog ? toolUsageLog : undefined,
      },
    });

    await logAudit({
      userId: user.id,
      action: "lesson.delivered",
      resourceType: "scheduledWork",
      resourceId: id,
      details: {
        classId: sw.classId,
        completionRate: updated.completionRate,
        deliveredAt: updated.deliveredAt,
      },
      schoolId: user.schoolId ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to mark as delivered" },
      { status: err?.status ?? 500 }
    );
  }
}
