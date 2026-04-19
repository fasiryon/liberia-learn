import { prisma } from "@/lib/db";
import { withRedisCache } from "@/lib/cache/redisCache";
import { compileTextbook, type TextbookResult } from "@/lib/ai/textbook/textbookCompiler";

const TEXTBOOK_CACHE_TTL_SECONDS = 15 * 60;

export async function getStudentTextbook(params: {
  subject: string;
  gradeLevel: number;
  schoolId?: string | null;
}): Promise<TextbookResult> {
  const subject = params.subject.trim().toUpperCase();
  const schoolId = params.schoolId ?? null;
  const cacheKey = `student:textbook:v1:${schoolId ?? "national"}:${params.gradeLevel}:${subject}`;

  return withRedisCache(cacheKey, TEXTBOOK_CACHE_TTL_SECONDS, async () => {
    const schoolScoped = schoolId
      ? await compileTextbook({ subject, gradeLevel: params.gradeLevel, schoolId })
      : null;
    if (schoolScoped && schoolScoped.units.length > 0) return schoolScoped;
    return compileTextbook({ subject, gradeLevel: params.gradeLevel });
  });
}

export async function getStudentTextbookSubjects(params: {
  gradeLevel: number;
  schoolId?: string | null;
}) {
  // CurriculumUnit is school-scoped — query it first
  const unitSubjects = await prisma.curriculumUnit.findMany({
    where: {
      grade: params.gradeLevel,
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    },
    distinct: ["subject"],
    select: { subject: true },
    orderBy: { subject: "asc" },
  });

  // When the school has its own units, surface only those subjects — avoids
  // leaking what subjects exist nationally across other tenants.
  if (params.schoolId && unitSubjects.length > 0) {
    return unitSubjects.map((entry) => entry.subject).sort();
  }

  // CurriculumContent has no schoolId: it is the national curriculum shared
  // across all tenants (intentional — it is MOE-published, not per-school).
  // Only include it when the school has no school-specific units, or when
  // there is no schoolId (e.g. national/MOE context).
  const contentSubjects = await prisma.curriculumContent.findMany({
    where: {
      grade: params.gradeLevel,
      status: "APPROVED",
    },
    distinct: ["subject"],
    select: { subject: true },
    orderBy: { subject: "asc" },
  });

  return Array.from(new Set([...contentSubjects, ...unitSubjects].map((entry) => entry.subject))).sort();
}
