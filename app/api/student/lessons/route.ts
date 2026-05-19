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

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        currentGrade: true,
        enrollments: { select: { Class: { select: { subject: true } } } },
      },
    });

    if (!student) {
      return NextResponse.json({ grade: null, count: 0, total: 0, page: 1, totalPages: 0, items: [] });
    }

    const where: Record<string, unknown> = {
      status: { in: ["published", "APPROVED"] },
    };

    if (student.currentGrade) {
      where.grade = student.currentGrade;
    }

    const classSubjects = student.enrollments
      .map((e) => e.Class?.subject)
      .filter(Boolean) as string[];

    if (classSubjects.length > 0) {
      where.subject = { in: classSubjects };
    }

    const cacheKey = `cache:lessons:${user.id}:page:${page}`;
    const lessonsData = await withRedisCache(cacheKey, 600, async () => {

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

    const scheduledRows = await prisma.scheduledWork.findMany({
      where: {
        class: {
          enrollments: { some: { studentId: student.id } },
        },
        content: { subject: { in: Array.from(new Set(rows.map((row) => row.subject))) } },
      },
      select: {
        id: true,
        content: { select: { subject: true } },
      },
    });
    const progressRows =
      scheduledRows.length > 0
        ? await prisma.studentProgress.findMany({
            where: {
              studentId: user.id,
              scheduledWorkId: { in: scheduledRows.map((row) => row.id) },
              completedAt: { not: null },
            },
            select: { scheduledWorkId: true },
          })
        : [];
    const completedIds = new Set(progressRows.map((row) => row.scheduledWorkId));
    const subjectTotals = new Map<string, { total: number; completed: number }>();
    for (const row of scheduledRows) {
      const subject = row.content.subject;
      const bucket = subjectTotals.get(subject) ?? { total: 0, completed: 0 };
      bucket.total += 1;
      if (completedIds.has(row.id)) bucket.completed += 1;
      subjectTotals.set(subject, bucket);
    }

    const qualityLessons = rows.filter((lesson) => {
      const payload = lesson.payload as any
      const content = payload?.content ?? payload?.lessonBody ?? payload?.body ?? ''
      return typeof content === 'string' && content.length >= 300
    })

    return {
      grade: student.currentGrade,
      studentId: student.id,
      count: qualityLessons.length,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      subjectCompletion: Array.from(subjectTotals.entries()).map(([subject, stats]) => ({
        subject,
        total: stats.total,
        completed: stats.completed,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      })),
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
    };
    }); // end withRedisCache

    return NextResponse.json(lessonsData);
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
