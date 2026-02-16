// app/api/admin/analytics/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "30", 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [lessonViews, homeworkSubmits, tutorMessages, homeworkComplete] =
      await Promise.all([
        prisma.auditLog.count({
          where: { action: "lesson_view", createdAt: { gte: since }, user: { schoolId: user.schoolId } },
        }),
        prisma.auditLog.count({
          where: { action: "homework_submit", createdAt: { gte: since }, user: { schoolId: user.schoolId } },
        }),
        prisma.auditLog.count({
          where: { action: "tutor_message", createdAt: { gte: since }, user: { schoolId: user.schoolId } },
        }),
        prisma.homeworkSubmission.count({
          where: { submittedAt: { gte: since }, Student: { user: { schoolId: user.schoolId } } },
        }),
      ]);

    const dailyActive: any[] = await prisma.$queryRaw`
      SELECT DATE(a."createdAt") as date, COUNT(DISTINCT a."userId") as users
      FROM "AuditLog" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."action" IN ('lesson_view','homework_submit','tutor_message')
        AND a."createdAt" >= ${since}
        AND u."schoolId" = ${user.schoolId}
      GROUP BY DATE(a."createdAt")
      ORDER BY date ASC
    `;

    const topLessons: any[] = await prisma.$queryRaw`
      SELECT a."details"->>'contentId' as "contentId", COUNT(*) as views
      FROM "AuditLog" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."action" = 'lesson_view'
        AND a."createdAt" >= ${since}
        AND a."details"->>'contentId' IS NOT NULL
        AND u."schoolId" = ${user.schoolId}
      GROUP BY a."details"->>'contentId'
      ORDER BY views DESC
      LIMIT 10
    `;

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      summary: { lessonViews, homeworkSubmits, tutorMessages, homeworkComplete },
      dailyActive,
      topLessons,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
