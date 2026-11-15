import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildWeeklyLeaderboard } from "@/lib/gamification/leaderboardService";

export const dynamic = "force-dynamic";

// route-policy: auth=cron; scope=none; authority=required-header-secret; rationale=missing configuration and URL credentials never authorize database or leaderboard work
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const explicit = req.headers.get("x-cron-secret");
  const authorized = explicit !== null ? explicit === expected : req.headers.get("authorization") === `Bearer ${expected}`;
  if (!expected?.trim() || !authorized) {
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
