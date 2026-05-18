import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generatePortfolioHtml } from "@/lib/pdf/portfolioPdf";
import type { SubjectBreakdown } from "@/lib/pdf/portfolioPdf";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function currentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const term = month <= 4 ? "T1" : month <= 8 ? "T2" : "T3";
  return `${year}-${term}`;
}

function termStart(): Date {
  const now = new Date();
  const month = now.getMonth() + 1;
  const startMonth = month <= 4 ? 0 : month <= 8 ? 4 : 8;
  return new Date(now.getFullYear(), startMonth, 1);
}

export async function POST(req: NextRequest) {
  const user = await requireRole("ADMIN");
  if (!user.schoolId) {
    return NextResponse.json({ error: "School context required" }, { status: 400 });
  }

  const term = currentTerm();
  const start = termStart();
  const now = new Date();
  const expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const students = await prisma.user.findMany({
    where: { schoolId: user.schoolId, role: "STUDENT" },
    select: {
      id: true,
      name: true,
      school: { select: { name: true } },
      student: { select: { currentGrade: true } },
    },
  });

  let generated = 0;
  const failed: string[] = [];

  const { put } = await import("@vercel/blob").catch(() => ({ put: null }));

  for (const student of students) {
    try {
      const [submissions, attendanceRows, progressRows] = await Promise.all([
        prisma.assignmentSubmission.findMany({
          where: { studentId: student.id, gradedAt: { gte: start }, score: { not: null } },
          include: { Assignment: { include: { Class: { select: { name: true } } } } },
        }),
        prisma.attendance.findMany({
          where: { schoolId: user.schoolId!, date: { gte: start } },
          select: { status: true },
        }),
        prisma.studentProgress.findMany({
          where: { studentId: student.id, completedAt: { gte: start } },
          select: { id: true, completedAt: true },
        }),
      ]);

      const avgScore =
        submissions.length > 0
          ? submissions.reduce((s, r) => s + (r.score ?? 0), 0) / submissions.length
          : 0;

      const attendance =
        attendanceRows.length > 0
          ? (attendanceRows.filter((a) => a.status === "PRESENT").length / attendanceRows.length) * 100
          : 0;

      const lessonsComplete = progressRows.filter((p) => p.completedAt != null).length;

      const bySubject: Record<string, { scores: number[]; assignments: number }> = {};
      for (const sub of submissions) {
        const subject = sub.Assignment?.Class?.name ?? "General";
        if (!bySubject[subject]) bySubject[subject] = { scores: [], assignments: 0 };
        bySubject[subject].assignments++;
        if (sub.score != null) bySubject[subject].scores.push(sub.score);
      }
      const subjects: SubjectBreakdown[] = Object.entries(bySubject).map(([subject, data]) => ({
        subject,
        assignmentsCompleted: data.assignments,
        avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
        bestScore: data.scores.length > 0 ? Math.max(...data.scores) : 0,
      }));

      const credential = await prisma.portfolioCredential.upsert({
        where: { studentId_term: { studentId: student.id, term } } as Parameters<typeof prisma.portfolioCredential.upsert>[0]["where"],
        create: {
          studentId: student.id,
          term,
          schoolName: student.school?.name ?? user.schoolId!,
          studentName: student.name ?? "Student",
          grade: student.student?.currentGrade != null ? `Grade ${student.student.currentGrade}` : "N/A",
          avgScore,
          attendance,
          lessonsComplete,
          expiresAt,
        },
        update: { avgScore, attendance, lessonsComplete, expiresAt },
      });

      if (put) {
        const html = await generatePortfolioHtml({
          studentName: credential.studentName,
          schoolName: credential.schoolName,
          grade: credential.grade,
          academicYear: String(now.getFullYear()),
          term,
          avgScore,
          attendance,
          lessonsComplete,
          verifyToken: credential.verifyToken,
          generatedAt: now,
          subjects,
        });

        const blobResult = await put(
          `portfolios/${student.id}/${term}/transcript.html`,
          Buffer.from(html, "utf-8"),
          { access: "public", contentType: "text/html; charset=utf-8" },
        );

        await prisma.portfolioCredential.update({
          where: { id: credential.id },
          data: { blobUrl: blobResult.url },
        });
      }

      generated++;
    } catch {
      failed.push(student.id);
    }
  }

  return NextResponse.json({ generated, failed, term, total: students.length });
}
