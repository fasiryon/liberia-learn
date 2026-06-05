import { NextResponse } from "next/server";
import { currentWeekWindow, computeSchoolWeeklyScores, assignDistrictRanks } from "@/lib/league/weeklyScore";
import { withRedisCache } from "@/lib/cache/redisCache";

export const dynamic = "force-dynamic";

export async function GET() {
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
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
  );
}
