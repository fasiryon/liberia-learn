import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/notifications/log — list notification history */
export async function GET() {
  try {
    await requireRole("TEACHER", "ADMIN");

    const logs = await prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
