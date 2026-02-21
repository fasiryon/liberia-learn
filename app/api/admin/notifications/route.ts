import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ logs: [] });

    // Get guardian user IDs for this school
    const schoolUsers = await prisma.user.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true },
    });
    const userIds = schoolUsers.map((u) => u.id);

    const logs = await prisma.notificationLog.findMany({
      where: { userId: { in: userIds } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

