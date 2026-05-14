import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();

    const item = await prisma.notificationInboxItem.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });

    if (!item || item.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.notificationInboxItem.update({
      where: { id: params.id },
      data: { isRead: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, { requestId, route: `/api/notifications/inbox/${params.id}`, method: "PATCH" });
  }
}
