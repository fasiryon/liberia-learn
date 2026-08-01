import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { sendPushToUser } from "@/lib/push/sendPush";
import { isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["UNDER_REVIEW", "ACKNOWLEDGED", "RETURNED"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isMoePortalEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = await requireUser();
    if (!user.isPlatformAdmin && !isMoeSuperRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status, moeNotes } = body as { status: string; moeNotes?: string };

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (status === "RETURNED" && !moeNotes?.trim()) {
      return NextResponse.json({ error: "Notes are required when returning a submission" }, { status: 400 });
    }

    const submission = await prisma.moeSubmission.findUnique({ where: { id: params.id } });
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.moeSubmission.update({
      where: { id: params.id },
      data: {
        status,
        moeNotes: moeNotes?.trim() || null,
        reviewedBy: user.name ?? user.email ?? user.id,
        reviewedAt: new Date(),
      },
    });

    // Notify school admins
    const admins = await prisma.user.findMany({
      where: { schoolId: submission.schoolId, role: "ADMIN" },
      select: { id: true },
    });
    const notificationPayload = {
      title: "MOE reviewed your submission",
      body: `${submission.title} — ${status.replace(/_/g, " ")}`,
      url: "/admin/moe-submissions",
    };
    // Push notifications (fire-and-forget)
    for (const admin of admins) {
      sendPushToUser(admin.id, notificationPayload).catch(() => null);
    }
    // Inbox notifications
    await prisma.notificationInboxItem.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: notificationPayload.title,
        body: notificationPayload.body,
        url: notificationPayload.url,
        type: "moe_review",
      })),
      skipDuplicates: true,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
