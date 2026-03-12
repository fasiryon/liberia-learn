import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGuardianDashboardEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!isGuardianDashboardEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN", "TEACHER");
    const { id } = params;

    const where =
      user.role === "TEACHER"
        ? { id, teacherId: user.id }
        : { id, guardianId: user.id };

    const message = await prisma.guardianMessage.findFirst({ where });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found or access denied" },
        { status: 404 }
      );
    }

    if (message.read) {
      return NextResponse.json({ messageId: id, read: true });
    }

    await prisma.guardianMessage.update({
      where: { id },
      data: { read: true },
    });

    void logAudit({
      userId: user.id,
      action: user.role === "TEACHER" ? "teacher.message.read" : "guardian.message.read",
      resourceType: "guardian_message",
      resourceId: id,
      schoolId: message.schoolId,
    });

    return NextResponse.json({ messageId: id, read: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
