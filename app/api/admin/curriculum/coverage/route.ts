import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { Redis } from "@upstash/redis";
import { GRADES, SUBJECTS, NATIONAL_GATE, type CoverageCell, type CoverageResult } from "@/lib/curriculum/coverageShared";
export { GRADES, SUBJECTS, NATIONAL_GATE, type CoverageCell, type CoverageResult };

export const dynamic = "force-dynamic";

let redis: Redis | null = null;
try {
  redis = Redis.fromEnv();
} catch {
  // Redis not configured — skip caching
}

export const COVERAGE_CACHE_KEY = "cache:curriculum:coverage";
const CACHE_TTL = 1800; // 30 minutes

const APPROVED_STATUSES = new Set(["published", "APPROVED"]);
const PENDING_STATUSES = new Set(["pending", "PENDING", "pending_approval", "PENDING_APPROVAL"]);

export async function buildCoverageMatrix(): Promise<CoverageResult> {
  // Single scan of all lesson rows + audio IDs in parallel
  const [rows, audioRows] = await Promise.all([
    prisma.curriculumContent.findMany({
      where: { contentType: "lesson" },
      select: { id: true, grade: true, subject: true, status: true },
    }),
    prisma.lessonAudio.findMany({
      where: { status: "GENERATED" },
      select: { lessonId: true },
      distinct: ["lessonId"],
    }),
  ]);

  const audioLessonIds = new Set(audioRows.map((r) => r.lessonId));

  type Counts = { approved: number; pending: number; needsReview: number; withAudio: number };
  const counts = new Map<string, Map<string, Counts>>();

  for (const gradeLabel of GRADES) {
    const m = new Map<string, Counts>();
    for (const subject of SUBJECTS) {
      m.set(subject, { approved: 0, pending: 0, needsReview: 0, withAudio: 0 });
    }
    counts.set(gradeLabel, m);
  }

  for (const row of rows) {
    const gradeLabel = `G${row.grade}`;
    const subjectKey = row.subject?.toUpperCase();
    const subjectMap = counts.get(gradeLabel);
    if (!subjectMap || !SUBJECTS.includes(subjectKey)) continue;
    const cell = subjectMap.get(subjectKey);
    if (!cell) continue;

    if (APPROVED_STATUSES.has(row.status)) {
      cell.approved += 1;
      if (audioLessonIds.has(row.id)) cell.withAudio += 1;
    } else if (PENDING_STATUSES.has(row.status)) {
      cell.pending += 1;
    } else if (row.status === "NEEDS_REVIEW") {
      cell.needsReview += 1;
    }
  }

  const matrix: Record<string, Record<string, CoverageCell>> = {};
  const deserts: Array<{ grade: string; subject: string }> = [];

  for (const gradeLabel of GRADES) {
    matrix[gradeLabel] = {};
    const subjectMap = counts.get(gradeLabel)!;
    for (const subject of SUBJECTS) {
      const c = subjectMap.get(subject)!;
      matrix[gradeLabel][subject] = { ...c, meetsGate: c.approved >= NATIONAL_GATE };
      if (c.approved === 0) deserts.push({ grade: gradeLabel, subject });
    }
  }

  const totalCells = GRADES.length * SUBJECTS.length;
  const passingCells = GRADES.flatMap((g) =>
    SUBJECTS.map((s) => matrix[g][s].meetsGate)
  ).filter(Boolean).length;

  return {
    matrix,
    summary: {
      totalCells,
      passingCells,
      coveragePercent: Math.round((passingCells / totalCells) * 100),
      nationalGate: NATIONAL_GATE,
      generatedAt: new Date().toISOString(),
    },
    deserts,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user, PERMISSIONS.CURRICULUM_COVERAGE_VIEW);

    if (redis) {
      const cached = await redis.get<CoverageResult>(COVERAGE_CACHE_KEY).catch(() => null);
      if (cached) return NextResponse.json(cached);
    }

    const result = await buildCoverageMatrix();

    if (redis) {
      redis.set(COVERAGE_CACHE_KEY, result, { ex: CACHE_TTL }).catch(() => null);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status });
  }
}
