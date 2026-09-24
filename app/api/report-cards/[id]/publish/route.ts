// route-policy: auth=session; scope=tenant; authority=school-admin; rationale=publishes a card of the admin school once, via a conditional claim
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";
import { createInboxNotification } from "@/lib/notifications/inboxService";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("ADMIN");

    const card = await prisma.reportCard.findUnique({ where: { id: params.id } });
    if (!card || card.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Report card not found" }, { status: 404 });
    }
    if (card.status === "PUBLISHED") {
      return NextResponse.json({ error: "Already published" }, { status: 400 });
    }

    // Conditional claim: of two concurrent publishes (double-click, retry),
    // only one transitions the card, so notifications go out once.
    const publishedAt = new Date();
    const claimed = await prisma.reportCard.updateMany({
      where: { id: params.id, schoolId: card.schoolId, status: { not: "PUBLISHED" } },
      data: { status: "PUBLISHED", publishedAt },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: "Already published" }, { status: 400 });
    }
    const updated = { ...card, status: "PUBLISHED" as const, publishedAt };

    void logAudit({
      userId: user.id,
      action: "report_card.published",
      resourceType: "ReportCard",
      resourceId: params.id,
      schoolId: user.schoolId ?? undefined,
    });

    await logProductSignal({
      schoolId: card.schoolId,
      classId: card.classId,
      userId: user.id,
      studentId: card.studentId,
      actor: { type: "user", id: user.id, role: user.role },
      target: { type: "report_card", id: card.id },
      eventType: "report_card.published",
      source: "/api/report-cards/[id]/publish",
      termId: card.termId,
      dedupeKey: `report_card.published:${card.schoolId}:${card.id}`,
      metadata: {
        status: "PUBLISHED",
      },
    });

    const studentUser = await prisma.student.findUnique({
      where: { id: card.studentId },
      select: {
        user: { select: { id: true } },
        guardians: { select: { guardianId: true } },
      },
    });
    if (studentUser?.user?.id) {
      sendPushToUser(studentUser.user.id, {
        title: "Report card published",
        body: "Your term report card is now available.",
        url: "/student/report-cards",
      }).catch(() => null);
      // Inbox notification for student
      void createInboxNotification(studentUser.user.id, {
        title: "Report Card Published",
        body: "Your term report card is now available to view.",
        url: "/student/report-cards",
        type: "report_card",
      }).catch(() => null);
      // Inbox notifications for guardians
      for (const { guardianId } of studentUser.guardians ?? []) {
        void createInboxNotification(guardianId, {
          title: "Report Card Published",
          body: "Your child's term report card is now available.",
          url: "/guardian/report-cards",
          type: "report_card",
        }).catch(() => null);
      }
    }

    return NextResponse.json({ reportCard: updated });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}
