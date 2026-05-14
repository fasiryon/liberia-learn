import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  try {
    const user = await requireUser();

    const [items, unreadCount] = await Promise.all([
      prisma.notificationInboxItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          body: true,
          url: true,
          type: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notificationInboxItem.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({ items, unreadCount });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/notifications/inbox", method: "GET" });
  }
}
