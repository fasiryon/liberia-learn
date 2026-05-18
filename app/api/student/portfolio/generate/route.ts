import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generatePortfolioHtml } from "@/lib/pdf/portfolioPdf";
import type { SubjectBreakdown } from "@/lib/pdf/portfolioPdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const user = await requireRole("STUDENT", "GUARDIAN");

  let targetStudentId: string = user.id;

  // Guardian can request on behalf of their linked student
  if (user.role === "GUARDIAN") {
    const body = await req.json().catch(() => ({}));
    const studentId: string | undefined = body?.studentId;
    if (!studentId) {
      return NextResponse.json({ error: "studentId required for guardian" }, { status: 400 });
    }
    const link = await prisma.studentGuardian.findFirst({
      where: { guardianId: user.id, student: { userId: studentId } },
    });
    if (!link) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    targetStudentId = studentId;
  }

  const studentUser = await prisma.user.findUnique({
    where: { id: targetStudentId },
    select: {
      id: true,
      name: true,
      schoolId: true,
      school: { select: { name: true } },
      student: { select: { currentGrade: true } },
    },
  });

  if (!studentUser) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const term = currentTerm();
  const start = termStart();
  const now = new Date();

  // Gather term data
  const [submissions, attendanceRows, progressRows] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: {
        studentId: targetStudentId,
        gradedAt: { gte: start },
        score: { not: null },
      },
      include: {
        Assignment: { include: { Class: { select: { name: true } } } },
      },
    }),
    prisma.attendance.findMany({
      where: { schoolId: studentUser.schoolId ?? "", date: { gte: start } },
      select: { status: true },
    }),
    prisma.studentProgress.findMany({
      where: { studentId: targetStudentId, completedAt: { gte: start } },
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

  // Build subject breakdown
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

  // Upsert credential record
  const expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const credential = await prisma.portfolioCredential.upsert({
    where: { studentId_term: { studentId: targetStudentId, term } } as Parameters<typeof prisma.portfolioCredential.upsert>[0]["where"],
    create: {
      studentId: targetStudentId,
      term,
      schoolName: studentUser.school?.name ?? "LiberiaLearn School",
      studentName: studentUser.name ?? "Student",
      grade: studentUser.student?.currentGrade != null ? `Grade ${studentUser.student.currentGrade}` : "N/A",
      avgScore,
      attendance,
      lessonsComplete,
      expiresAt,
    },
    update: {
      avgScore,
      attendance,
      lessonsComplete,
      expiresAt,
    },
  });

  // Generate HTML for PDF upload
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

  // Upload to Vercel Blob as HTML (browser-renderable transcript)
  let blobUrl: string | undefined;
  try {
    const { put } = await import("@vercel/blob");
    const blobResult = await put(
      `portfolios/${targetStudentId}/${term}/transcript.html`,
      Buffer.from(html, "utf-8"),
      { access: "public", contentType: "text/html; charset=utf-8" },
    );
    blobUrl = blobResult.url;

    await prisma.portfolioCredential.update({
      where: { id: credential.id },
      data: { blobUrl },
    });
  } catch {
    // Blob upload optional — credential is still valid without it
  }

  return NextResponse.json({
    credentialId: credential.id,
    verifyToken: credential.verifyToken,
    verifyUrl: `/credential/${credential.verifyToken}`,
    blobUrl: blobUrl ?? null,
    term,
    avgScore,
    attendance,
    lessonsComplete,
  });
}
