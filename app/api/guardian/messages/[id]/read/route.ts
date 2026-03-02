// app/api/guardian/messages/[id]/read/route.ts
//
// PATCH /api/guardian/messages/[id]/read
//
// Marks a guardian message as read. A guardian can only mark their own messages.
//
// Feature flag : ENABLE_GUARDIAN_DASHBOARD (default OFF → 404)
// Auth         : GUARDIAN role
// Scope        : message must belong to the requesting guardian

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

    const user = await requireRole("GUARDIAN");
    const { id } = params;

    // Verify the message belongs to this guardian
    const message = await prisma.guardianMessage.findFirst({
      where: { id, guardianId: user.id },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found or access denied" },
        { status: 404 }
      );
    }

    if (message.read) {
      // Already read — idempotent, return success
      return NextResponse.json({ messageId: id, read: true });
    }

    await prisma.guardianMessage.update({
      where: { id },
      data: { read: true },
    });

    void logAudit({
      userId: user.id,
      action: "guardian.message.read",
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
