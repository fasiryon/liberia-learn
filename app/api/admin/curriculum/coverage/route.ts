import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const APPROVED_STATUSES = ["published", "APPROVED"];
const PIPELINE_STATUSES = ["pending_approval", "PENDING_APPROVAL", "DRAFT", "draft"];

export async function GET() {
  try {
    await requireRole("ADMIN");

    const rows = await prisma.curriculumContent.findMany({
      where: { contentType: "lesson" },
      select: { grade: true, subject: true, status: true },
    });

    const byGrade: Record<number, { approved: number; pipeline: number; total: number }> = {};
    const bySubject: Record<string, { approved: number; pipeline: number }> = {};

    for (const row of rows) {
      const g = row.grade;
      if (!byGrade[g]) byGrade[g] = { approved: 0, pipeline: 0, total: 0 };
      byGrade[g].total += 1;

      const subj = row.subject;
      if (!bySubject[subj]) bySubject[subj] = { approved: 0, pipeline: 0 };

      if (APPROVED_STATUSES.includes(row.status)) {
        byGrade[g].approved += 1;
        bySubject[subj].approved += 1;
      } else if (PIPELINE_STATUSES.includes(row.status)) {
        byGrade[g].pipeline += 1;
        bySubject[subj].pipeline += 1;
      }
    }

    // Gap severity thresholds
    const gradeStats = Object.entries(byGrade).map(([grade, counts]) => {
      const g = Number(grade);
      const severity: "critical" | "severe" | "adequate" =
        counts.approved < 5 ? "critical" : counts.approved <= 10 ? "severe" : "adequate";
      return { grade: g, ...counts, severity };
    });
    gradeStats.sort((a, b) => a.grade - b.grade);

    const subjectStats = Object.entries(bySubject).map(([subject, counts]) => ({
      subject,
      ...counts,
    }));

    return NextResponse.json({ gradeStats, subjectStats });
  } catch (err: any) {
    if (err?.message === "Unauthorized" || err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
