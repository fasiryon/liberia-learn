// route-policy: auth=session; scope=platform; authority=platform-admin; rationale=only a platform ADMIN may compute and write national league snapshots
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  previousWeekWindow,
  computeSchoolWeeklyScores,
  assignDistrictRanks,
} from "@/lib/league/weeklyScore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
  const user = await requireRole("ADMIN");
  if (user.isPlatformAdmin !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
      // continue
    }
  }

  return NextResponse.json({
    week_start: window.weekStart.toISOString(),
    week_end: window.weekEnd.toISOString(),
    snapshots_written: snapshotCount,
  });
  } catch (error: unknown) {
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: status >= 500 ? "National snapshot reset failed" : "Forbidden" }, { status });
  }
}
