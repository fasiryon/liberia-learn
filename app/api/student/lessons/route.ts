import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCurriculumDisplayTitle } from "@/lib/curriculum/title";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: {
        currentGrade: true,
        enrollments: { select: { Class: { select: { subject: true } } } },
      },
    });

    if (!student) {
      return NextResponse.json({ grade: null, count: 0, items: [] });
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

    const rows = await prisma.curriculumContent.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: {
        contentId: true,
        title: true,
        grade: true,
        subject: true,
        contentType: true,
        status: true,
        payload: true,
      },
    });

    return NextResponse.json({
      grade: student.currentGrade,
      count: rows.length,
      items: rows.map((row) => ({
        contentId: row.contentId,
        title: row.title,
        grade: row.grade,
        subject: row.subject,
        contentType: row.contentType,
        status: row.status,
        displayTitle: buildCurriculumDisplayTitle({
          title: row.title,
          subject: row.subject,
          gradeLevel: row.grade,
          payload: row.payload,
        }),
      })),
    });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
