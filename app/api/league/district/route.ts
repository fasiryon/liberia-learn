// route-policy: auth=session; scope=platform; authority=any-signed-in-role; rationale=cross-school aggregates (not limited to the caller's school), unchanged access; district league tables and per-school weekly rank/history for any signed-in role; the server session check runs first (U1) and responses are never shared-cached
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentWeekWindow, computeSchoolWeeklyScores, assignDistrictRanks } from "@/lib/league/weeklyScore";
import { withRedisCache } from "@/lib/cache/redisCache";

export const dynamic = "force-dynamic";

/** U1: the authoritative server session check (revocation, disable, lifetime). Any failure is refused, never served. */
async function refuseUnlessCurrentSession(): Promise<NextResponse | null> {
  try {
    await requireUser();
    return null;
  } catch (err: any) {
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500;
    return NextResponse.json({ error: status === 500 ? "Session check failed" : "Unauthorized" }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function GET(req: NextRequest) {
  const refused = await refuseUnlessCurrentSession();
  if (refused) return refused;
  const { searchParams } = new URL(req.url);
  const district = searchParams.get("district");
  const schoolId = searchParams.get("schoolId");
  const history = searchParams.get("history") === "true";

  if (history && schoolId) {
    return getSchoolHistory(schoolId);
  }

  if (schoolId && !district) {
    return getSchoolRank(schoolId);
  }

  if (!district) {
    return NextResponse.json({ error: "district or schoolId required" }, { status: 400 });
  }

  return getDistrictLeaderboard(district);
}

async function getDistrictLeaderboard(district: string) {
  const window = currentWeekWindow();
  const cacheKey = `league:district:${district}:${window.weekStart.toISOString()}`;

  const data = await withRedisCache(cacheKey, 60, async () => {
    const scores = await computeSchoolWeeklyScores(window);
    const ranked = assignDistrictRanks(scores);
    return ranked.filter((s) => s.district === district);
  });

  const nextReset = currentWeekWindow().weekEnd;

  return NextResponse.json(
    {
      district,
      weekStart: window.weekStart.toISOString(),
      weekEnd: window.weekEnd.toISOString(),
      nextReset: nextReset.toISOString(),
      rows: data,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

async function getSchoolRank(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { district: true, name: true },
  });

  if (!school?.district) {
    return NextResponse.json({ rank: null, total: null, district: null, schoolName: null });
  }

  const window = currentWeekWindow();
  const scores = await computeSchoolWeeklyScores(window);
  const ranked = assignDistrictRanks(scores).filter((s) => s.district === school.district);

  const entry = ranked.find((s) => s.schoolId === schoolId);
  const total = ranked.length;

  return NextResponse.json({
    rank: entry?.rank ?? null,
    total,
    score: entry?.score ?? null,
    district: school.district,
    schoolName: school.name,
    weekStart: window.weekStart.toISOString(),
    nextReset: window.weekEnd.toISOString(),
  });
}

async function getSchoolHistory(schoolId: string) {
  const snapshots = await prisma.leagueWeekSnapshot.findMany({
    where: { schoolId },
    orderBy: { weekStart: "desc" },
    take: 4,
    select: {
      weekStart: true,
      weekEnd: true,
      rank: true,
      score: true,
      district: true,
    },
  });

  // Also get how many schools were in each district-week
  const history = await Promise.all(
    snapshots.map(async (s) => {
      const total = await prisma.leagueWeekSnapshot.count({
        where: { district: s.district, weekStart: s.weekStart },
      });
      return { ...s, total };
    })
  );

  return NextResponse.json({ schoolId, history });
}
