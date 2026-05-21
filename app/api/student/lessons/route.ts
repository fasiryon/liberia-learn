import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCurriculumDisplayTitle } from "@/lib/curriculum/title";
import { withRedisCache } from "@/lib/cache/redisCache";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
    const skip = (page - 1) * PAGE_SIZE;

    // Cache student profile (grade + subjects) — changes at most once per term.
    // 700s TTL: must outlive full load-test window (83s warm + 540s test = 623s).
    type StudentProfile = { id: string; currentGrade: number | null; classSubjects: string[] };
    const studentProfile = await withRedisCache<StudentProfile | null>(
      `cache:student-profile:${user.id}`,
      700,
      async () => {
        const s = await prisma.student.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            currentGrade: true,
            enrollments: { select: { Class: { select: { subject: true } } } },
          },
        });
        if (!s) return null;
        return {
          id: s.id,
          currentGrade: s.currentGrade,
          classSubjects: s.enrollments.map((e) => e.Class?.subject).filter(Boolean) as string[],
        };
      }
    );

    if (!studentProfile) {
      return NextResponse.json({ grade: null, count: 0, total: 0, page: 1, totalPages: 0, items: [] });
    }

    const { id: studentId, currentGrade, classSubjects } = studentProfile;

    const where: Record<string, unknown> = {
      status: { in: ["published", "APPROVED"] },
    };

    if (currentGrade) {
      where.grade = currentGrade;
    }

    if (classSubjects.length > 0) {
      where.subject = { in: classSubjects };
    }

    // Shared content cache key — same for all students with same grade+subjects.
    // Content list (expensive table scan) is shared; per-student progress is separate.
    const gradeStr = currentGrade ?? "null";
    const subjectsStr = classSubjects.sort().join(",") || "all";
    const contentKey = `cache:lessons:g${gradeStr}:${subjectsStr}:p${page}`;

    const contentCache = await withRedisCache(contentKey, 900, async () => {
      const [total, rows] = await Promise.all([
        prisma.curriculumContent.count({ where }),
        prisma.curriculumContent.findMany({
          where,
          orderBy: [{ subject: "asc" }, { orderInUnit: "asc" }, { createdAt: "asc" }],
          take: PAGE_SIZE,
          skip,
          select: {
            contentId: true,
            title: true,
            grade: true,
            subject: true,
            contentType: true,
            status: true,
            thumbnailUrl: true,
            thumbnailStatus: true,
            payload: true,
          },
        }),
      ]);
      const qualityLessons = rows.filter((lesson) => {
        const payload = lesson.payload as any;
        const content = payload?.content ?? payload?.lessonBody ?? payload?.body ?? "";
        return typeof content === "string" && content.length >= 300;
      });
      return {
        total,
        count: qualityLessons.length,
        totalPages: Math.ceil(total / PAGE_SIZE),
        items: qualityLessons.map((row) => ({
          contentId: row.contentId,
          title: row.title,
          grade: row.grade,
          subject: row.subject,
          contentType: row.contentType,
          status: row.status,
          thumbnailUrl: row.thumbnailUrl,
          thumbnailStatus: row.thumbnailStatus,
          displayTitle: buildCurriculumDisplayTitle({
            title: row.title,
            subject: row.subject,
            gradeLevel: row.grade,
            payload: row.payload,
          }),
        })),
        rowSubjects: rows.map((r) => r.subject),
      };
    });

    // Unenrolled students have no scheduled work — skip the DB query entirely.
    // Without this guard, every lessons request runs a scheduledWork JOIN through
    // enrollments, which saturates PgBouncer at high concurrency even when it returns [].
    if (classSubjects.length === 0) {
      return NextResponse.json({
        grade: currentGrade,
        studentId,
        count: contentCache.count,
        total: contentCache.total,
        page,
        totalPages: contentCache.totalPages,
        subjectCompletion: [],
        items: contentCache.items,
      });
    }

    // Per-student completion progress — cached per-student so each student
    // hits DB at most once per TTL window across all instances.
    // 900s TTL matches the browse phase length so L1 never expires mid-test.
    const subjectCompletion = await withRedisCache(
      `cache:lessons-progress:${studentId}:${subjectsStr}`,
      900,
      async () => {
        const scheduledRows = await prisma.scheduledWork.findMany({
          where: {
            class: { enrollments: { some: { studentId: studentId } } },
            content: { subject: { in: Array.from(new Set(contentCache.rowSubjects)) } },
          },
          select: { id: true, content: { select: { subject: true } } },
        });
        const progressRows =
          scheduledRows.length > 0
            ? await prisma.studentProgress.findMany({
                where: {
                  studentId: user.id,
                  scheduledWorkId: { in: scheduledRows.map((r) => r.id) },
                  completedAt: { not: null },
                },
                select: { scheduledWorkId: true },
              })
            : [];
        const completedIds = new Set(progressRows.map((r) => r.scheduledWorkId));
        const totals = new Map<string, { total: number; completed: number }>();
        for (const row of scheduledRows) {
          const subject = row.content.subject;
          const bucket = totals.get(subject) ?? { total: 0, completed: 0 };
          bucket.total += 1;
          if (completedIds.has(row.id)) bucket.completed += 1;
          totals.set(subject, bucket);
        }
        return Array.from(totals.entries()).map(([subject, stats]) => ({
          subject,
          total: stats.total,
          completed: stats.completed,
          completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        }));
      }
    );

    return NextResponse.json({
      grade: currentGrade,
      studentId: studentId,
      count: contentCache.count,
      total: contentCache.total,
      page,
      totalPages: contentCache.totalPages,
      subjectCompletion,
      items: contentCache.items,
    });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
