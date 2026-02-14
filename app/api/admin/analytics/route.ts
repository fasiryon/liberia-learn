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
          where: { action: "lesson_view", createdAt: { gte: since } },
        }),
        prisma.auditLog.count({
          where: { action: "homework_submit", createdAt: { gte: since } },
        }),
        prisma.auditLog.count({
          where: { action: "tutor_message", createdAt: { gte: since } },
        }),
        prisma.homeworkSubmission.count({
          where: { submittedAt: { gte: since } },
        }),
      ]);

    const dailyActive: any[] = await prisma.$queryRaw`
      SELECT DATE("createdAt") as date, COUNT(DISTINCT "userId") as users
      FROM "AuditLog"
      WHERE "action" IN ('lesson_view','homework_submit','tutor_message')
        AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const topLessons: any[] = await prisma.$queryRaw`
      SELECT "details"->>'contentId' as "contentId", COUNT(*) as views
      FROM "AuditLog"
      WHERE "action" = 'lesson_view'
        AND "createdAt" >= ${since}
        AND "details"->>'contentId' IS NOT NULL
      GROUP BY "details"->>'contentId'
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
