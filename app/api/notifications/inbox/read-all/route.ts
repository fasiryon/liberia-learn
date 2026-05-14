import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST() {
  const requestId = randomUUID();
  try {
    const user = await requireUser();

    await prisma.notificationInboxItem.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/notifications/inbox/read-all", method: "POST" });
  }
}
