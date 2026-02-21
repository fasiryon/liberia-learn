// app/api/guardian/students/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("GUARDIAN");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const links = await prisma.studentGuardian.findMany({
      where: { guardianId: user.id },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            homeworkSubmissions: {
              orderBy: { submittedAt: "desc" },
              take: 1,
              include: {
                Homework: { select: { title: true } },
              },
            },
            placementTests: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    const students = await Promise.all(
      links.map(async (link) => {
        const s = link.student;

        // Count lesson_view events in last 7 days
        const lessonViews = await prisma.auditLog.count({
          where: {
            userId: s.userId,
            action: "lesson_view",
            createdAt: { gte: sevenDaysAgo },
          },
        });

        const lastHw = s.homeworkSubmissions[0] ?? null;
        const placement = s.placementTests[0] ?? null;

        return {
          studentId: s.id,
          name: s.user.name,
          email: s.user.email,
          currentGrade: s.currentGrade,
          relation: link.relation,
          lastHomework: lastHw
            ? {
                title: lastHw.Homework.title,
                submittedAt: lastHw.submittedAt,
                aiScore: lastHw.aiReviewed ? lastHw.aiScore : null,
                teacherScore: lastHw.teacherScore,
                aiReviewed: lastHw.aiReviewed,
              }
            : null,
          placement: placement
            ? {
                band: placement.band,
                estimatedGrade: placement.estimatedGrade,
                levelLabel: placement.levelLabel,
              }
            : null,
          lessonViewsThisWeek: lessonViews,
        };
      })
    );

    return NextResponse.json({ students });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}

