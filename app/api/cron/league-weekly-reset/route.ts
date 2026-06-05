import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  previousWeekWindow,
  computeSchoolWeeklyScores,
  assignDistrictRanks,
} from "@/lib/league/weeklyScore";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const window = previousWeekWindow();
  const scores = await computeSchoolWeeklyScores(window);
  const ranked = assignDistrictRanks(scores);

  let snapshotCount = 0;

  for (const s of ranked) {
    try {
      await prisma.leagueWeekSnapshot.upsert({
        where: {
          district_weekStart_schoolId: {
            district: s.district,
            weekStart: window.weekStart,
            schoolId: s.schoolId,
          },
        },
        create: {
          district: s.district,
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          schoolId: s.schoolId,
          schoolName: s.schoolName,
          rank: s.rank,
          score: s.score,
          pointsTotal: s.pointsTotal,
          enrollmentCount: s.enrollmentCount,
        },
        update: {
          rank: s.rank,
          score: s.score,
          pointsTotal: s.pointsTotal,
          enrollmentCount: s.enrollmentCount,
        },
      });
      snapshotCount++;
    } catch {
      // continue on individual failure
    }
  }

  return NextResponse.json({
    week_start: window.weekStart.toISOString(),
    week_end: window.weekEnd.toISOString(),
    snapshots_written: snapshotCount,
  });
}
