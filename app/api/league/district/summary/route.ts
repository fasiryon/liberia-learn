// route-policy: auth=session; scope=platform; authority=any-signed-in-role; rationale=cross-school aggregates (not limited to the caller's school), unchanged access; district summary for any signed-in role; the server session check runs first (U1) and responses are never shared-cached
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
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

export async function GET() {
  const refused = await refuseUnlessCurrentSession();
  if (refused) return refused;
  const window = currentWeekWindow();
  const cacheKey = `league:district:summary:${window.weekStart.toISOString()}`;

  const districts = await withRedisCache(cacheKey, 120, async () => {
    const scores = await computeSchoolWeeklyScores(window);
    const ranked = assignDistrictRanks(scores);

    const byDistrict: Record<string, typeof ranked> = {};
    for (const s of ranked) {
      if (!byDistrict[s.district]) byDistrict[s.district] = [];
      byDistrict[s.district].push(s);
    }

    return Object.entries(byDistrict).map(([district, list]) => {
      const top = list[0];
      return {
        district,
        topSchool: top?.schoolName ?? "—",
        topScore: top?.score ?? 0,
        schoolCount: list.length,
      };
    }).sort((a, b) => a.district.localeCompare(b.district));
  });

  return NextResponse.json(
    { weekStart: window.weekStart.toISOString(), districts },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
