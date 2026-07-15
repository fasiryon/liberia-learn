import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function currentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const term = month <= 4 ? "T1" : month <= 8 ? "T2" : "T3";
  return `${year}-${term}`;
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const term = currentTerm();
  const now = new Date();
  const termStart = new Date(now.getFullYear(), now.getMonth() <= 3 ? 0 : now.getMonth() <= 7 ? 4 : 8, 1);

  const schools = await prisma.school.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, county: true, district: true },
  });

  let processed = 0;

  for (const school of schools) {
    try {
      const [gradeRows, attendanceRows, progressRows, studentCount] = await Promise.all([
        prisma.assignmentSubmission.findMany({
          where: {
            Assignment: { Class: { schoolId: school.id } },
            score: { not: null },
            gradedAt: { gte: termStart },
          },
          select: { score: true },
        }),
        prisma.attendance.findMany({
          where: {
            schoolId: school.id,
            date: { gte: termStart },
          },
          select: { status: true },
        }),
        prisma.studentProgress.findMany({
          where: {
            scheduledWork: { class: { schoolId: school.id } },
            startedAt: { gte: termStart },
          },
          select: { id: true, completedAt: true },
        }).catch(() => [] as { id: string; completedAt: Date | null }[]),
        prisma.student.count({
          where: { user: { schoolId: school.id } },
        }),
      ]);

      const avgGrade =
        gradeRows.length > 0
          ? gradeRows.reduce((s, r) => s + (r.score ?? 0), 0) / gradeRows.length
          : 0;

      const attendance =
        attendanceRows.length > 0
          ? (attendanceRows.filter((a) => a.status === "PRESENT").length / attendanceRows.length) * 100
          : 0;

      const lessonCompletion =
        progressRows.length > 0
          ? (progressRows.filter((l) => l.completedAt != null).length / progressRows.length) * 100
          : 0;

      await prisma.leagueSnapshot.upsert({
        where: { schoolId_term: { schoolId: school.id, term } },
        create: {
          schoolId: school.id,
          term,
          avgGrade,
          attendance,
          lessonCompletion,
          studentCount,
        },
        update: {
          avgGrade,
          attendance,
          lessonCompletion,
          studentCount,
        },
      });

      processed++;
    } catch {
      // Continue processing remaining schools
    }
  }

  // Compute composite scores and assign national + county + district ranks
  const snapshots = await prisma.leagueSnapshot.findMany({
    where: { term },
    include: { school: { select: { county: true, district: true } } },
  });

  const scored = snapshots.map((s) => ({
    id: s.id,
    county: s.school.county ?? "Unknown",
    district: s.school.district ?? "Unknown",
    composite: s.avgGrade * 0.5 + s.attendance * 0.3 + s.lessonCompletion * 0.2,
  }));

  scored.sort((a, b) => b.composite - a.composite);

  // National ranks
  const nationalUpdates = scored.map((s, i) => ({
    id: s.id,
    nationalRank: i + 1,
    county: s.county,
    district: s.district,
  }));

  // County ranks
  const byCounty: Record<string, typeof nationalUpdates> = {};
  for (const s of nationalUpdates) {
    if (!byCounty[s.county]) byCounty[s.county] = [];
    byCounty[s.county].push(s);
  }
  const countyRanks: Record<string, number> = {};
  for (const [, list] of Object.entries(byCounty)) {
    list.forEach((s, i) => { countyRanks[s.id] = i + 1; });
  }

  // District ranks
  const byDistrict: Record<string, typeof nationalUpdates> = {};
  for (const s of nationalUpdates) {
    if (!byDistrict[s.district]) byDistrict[s.district] = [];
    byDistrict[s.district].push(s);
  }
  const districtRanks: Record<string, number> = {};
  for (const [, list] of Object.entries(byDistrict)) {
    list.forEach((s, i) => { districtRanks[s.id] = i + 1; });
  }

  await Promise.all(
    nationalUpdates.map((s) =>
      prisma.leagueSnapshot.update({
        where: { id: s.id },
        data: {
          nationalRank: s.nationalRank,
          countyRank: countyRanks[s.id] ?? null,
          districtRank: districtRanks[s.id] ?? null,
        },
      }),
    ),
  );

  return NextResponse.json({ schools_processed: processed, term });
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
