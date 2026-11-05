// route-policy: auth=session; scope=platform; authority=any-signed-in-role; rationale=cross-school aggregates (not limited to the caller's school), unchanged access; school-level league aggregates for any signed-in role; the server session check runs first (U1) and responses are never shared-cached
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withRedisCache, FALLBACK_LIMIT_EXCEEDED } from "@/lib/cache/redisCache";
import { isLeagueTableFlagEnabled } from "@/lib/flags";

// Signed-in aggregate data (middleware requires a session). U1: no shared CDN cache, because a cached response would
// be served to a revoked session without the server check; the Redis cache below still absorbs database load.
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

function currentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const term = month <= 4 ? "T1" : month <= 8 ? "T2" : "T3";
  return `${year}-${term}`;
}

export async function GET(req: NextRequest) {
  const refused = await refuseUnlessCurrentSession();
  if (refused) return refused;
  if (!(await isLeagueTableFlagEnabled())) {
    return NextResponse.json({ error: "league_table_disabled" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const term = searchParams.get("term") ?? currentTerm();
  const county = searchParams.get("county") ?? undefined;

  // Shield: cap the entire handler at 1000ms so a cold-cache league DB query
  // (which competes with today/lessons for pgbouncer connections) never
  // contributes more than 1s to the student_browse p(95).
  const result = await Promise.race([
    _computeLeague(term, county),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
  ]);

  const { rows, updatedAt } = result ?? { rows: [], updatedAt: null };

  return NextResponse.json(
    { term, updatedAt, rows },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

async function _computeLeague(
  term: string,
  county: string | undefined
): Promise<{ rows: ReturnType<typeof mapSnapshot>[]; updatedAt: Date | null }> {
  try {
    const cacheKey = county ? `cache:league:${term}:county:${county}` : `cache:league:${term}`;

    const snapshots = await withRedisCache(
      cacheKey,
      3600,
      () =>
        prisma.leagueSnapshot.findMany({
          where: { term, ...(county ? { school: { county } } : {}) },
          orderBy: { nationalRank: "asc" },
          include: {
            school: { select: { name: true, county: true, district: true } },
          },
          take: 200,
        })
    );

    return { rows: snapshots.map(mapSnapshot), updatedAt: snapshots[0]?.createdAt ?? null };
  } catch (e: any) {
    if (e?.code === FALLBACK_LIMIT_EXCEEDED) {
      return { rows: [], updatedAt: null };
    }
    throw e;
  }
}

function mapSnapshot(s: {
  id: string; schoolId: string; school: { name: string; county: string | null; district: string | null };
  term: string; avgGrade: number; attendance: number; lessonCompletion: number;
  studentCount: number; nationalRank: number | null; countyRank: number | null; createdAt: Date;
}) {
  return {
    id: s.id,
    schoolId: s.schoolId,
    schoolName: s.school.name,
    county: s.school.county ?? "",
    district: s.school.district ?? "",
    term: s.term,
    avgGrade: s.avgGrade,
    attendance: s.attendance,
    lessonCompletion: s.lessonCompletion,
    studentCount: s.studentCount,
    nationalRank: s.nationalRank,
    countyRank: s.countyRank,
    score: s.avgGrade * 0.5 + s.attendance * 0.3 + s.lessonCompletion * 0.2,
  };
}
