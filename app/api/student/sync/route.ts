import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const { items } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0 });
    }

    let synced = 0;
    let skipped = 0;

    for (const item of items) {
      const { scheduledWorkId, completedAt } = item;
      if (!scheduledWorkId) { skipped++; continue; }

      try {
        await prisma.studentProgress.upsert({
          where: { studentId_scheduledWorkId: { studentId: user.id, scheduledWorkId } },
          create: {
            studentId: user.id,
            scheduledWorkId,
            startedAt: new Date(completedAt),
            completedAt: new Date(completedAt),
          },
          update: {
            completedAt: new Date(completedAt),
          },
        });
        synced++;
      } catch {
        skipped++;
      }
    }

    await logAudit({
      userId: user.id,
      action: "offline.sync",
      resourceType: "studentProgress",
      details: { synced, skipped } as any,
    });

    return NextResponse.json({ synced, skipped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
