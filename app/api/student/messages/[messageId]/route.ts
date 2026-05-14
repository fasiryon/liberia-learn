import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const message = await prisma.message.findUnique({
      where: { id: params.messageId },
      select: { id: true, fromUserId: true, deletedBySender: true },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (message.fromUserId !== user.id) {
      return NextResponse.json({ error: "You can only retract your own messages" }, { status: 403 });
    }
    if (message.deletedBySender) {
      return NextResponse.json({ deleted: true });
    }

    await prisma.message.update({
      where: { id: params.messageId },
      data: { deletedBySender: true, deletedAt: new Date() },
    });

    void logAudit({
      userId: user.id,
      action: "student.message.retracted",
      resourceType: "message",
      resourceId: params.messageId,
    });

    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
