import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function currentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const term = month <= 4 ? "T1" : month <= 8 ? "T2" : "T3";
  return `${year}-${term}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const term = searchParams.get("term") ?? currentTerm();
  const county = searchParams.get("county") ?? undefined;

  const whereCounty = county ? { school: { county } } : {};

  const snapshots = await prisma.leagueSnapshot.findMany({
    where: { term, ...whereCounty },
    orderBy: { nationalRank: "asc" },
    include: {
      school: { select: { name: true, county: true, district: true } },
    },
    take: 200,
  });

  const rows = snapshots.map((s) => ({
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
  }));

  const updatedAt = snapshots[0]?.createdAt ?? null;

  return NextResponse.json(
    { term, updatedAt, rows },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=600",
      },
    },
  );
}
