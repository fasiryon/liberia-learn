import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildWeeklyLeaderboard } from "@/lib/gamification/leaderboardService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all classes that have had enrollments
  const classes = await prisma.class.findMany({
    where: {
      enrollments: { some: {} },
    },
    select: { id: true, schoolId: true },
  });

  let built = 0;
  let failed = 0;

  for (const cls of classes) {
    try {
      await buildWeeklyLeaderboard(cls.id, cls.schoolId);
      built++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, built, failed, total: classes.length });
}
