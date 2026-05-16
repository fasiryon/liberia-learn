import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ProgressReportDocument, type ProgressReportData } from "@/lib/reports/progressReportPDF";

export const dynamic = "force-dynamic";

function gradeLetter(avg: number) {
  if (avg >= 90) return "A";
  if (avg >= 80) return "B";
  if (avg >= 70) return "C";
  if (avg >= 60) return "D";
  return "F";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const role = (session.user as { role?: string }).role ?? "";

    const { studentId } = params;
    const termId = req.nextUrl.searchParams.get("termId");

    // Load student with user and guardians
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { id: true, name: true, schoolId: true } },
        guardians: { select: { guardianId: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Authorization
    if (role === "STUDENT") {
      if (student.userId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (role === "GUARDIAN") {
      const isGuardian = student.guardians.some((sg) => sg.guardianId === userId);
      if (!isGuardian) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (role === "TEACHER" || role === "ADMIN") {
      const adminUser = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
      if (adminUser?.schoolId !== student.user.schoolId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!(session.user as { isPlatformAdmin?: boolean }).isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const school = await prisma.school.findUnique({
      where: { id: student.user.schoolId! },
      select: { name: true },
    });

    // Determine date window
    let termName = "Current Term";
    let startDate: Date = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let endDate: Date = new Date();

    if (termId) {
      const term = await prisma.term.findUnique({
        where: { id: termId },
        include: { academicYear: { select: { yearLabel: true } } },
      });
      if (term) {
        termName = `${term.name} — ${term.academicYear.yearLabel}`;
        startDate = term.startDate;
        endDate = term.endDate;
      }
    }

    // --- Attendance (operational Attendance model) ---
    const attendanceRows = await prisma.attendance.findMany({
      where: {
        studentId,
        date: { gte: startDate, lte: endDate },
      },
      select: { status: true },
    });
    const attPresent = attendanceRows.filter((r) => r.status === "PRESENT").length;
    const attAbsent = attendanceRows.filter((r) => r.status === "ABSENT").length;
    const attLate = attendanceRows.filter((r) => r.status === "LATE").length;
    const attTotal = attPresent + attAbsent + attLate;
    const attRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

    // --- Assignment scores by subject ---
    const submissions = await prisma.assignmentSubmission.findMany({
      where: {
        studentId,
        score: { not: null },
        OR: [
          { gradedAt: { gte: startDate, lte: endDate } },
          { turnedInAt: { gte: startDate, lte: endDate } },
        ],
      },
      include: {
        Assignment: {
          include: { Class: { select: { subject: true } } },
        },
      },
    });

    const subjectScoreMap = new Map<string, number[]>();
    for (const sub of submissions) {
      const subject = String(sub.Assignment.Class.subject);
      if (!subjectScoreMap.has(subject)) subjectScoreMap.set(subject, []);
      subjectScoreMap.get(subject)!.push(sub.score!);
    }

    // --- Exam scores from Grade model (by class) ---
    const gradeRows = await prisma.grade.findMany({
      where: { studentId },
      include: { Class: { select: { subject: true } } },
    });
    const examMap = new Map<string, number[]>();
    for (const g of gradeRows) {
      const subj = String(g.Class.subject);
      if (!examMap.has(subj)) examMap.set(subj, []);
      examMap.get(subj)!.push(g.percent);
    }

    // --- Build subject rows ---
    const allSubjects = new Set([...subjectScoreMap.keys(), ...examMap.keys()]);

    const subjectRows: ProgressReportData["subjects"] = [];
    let totalAvgSum = 0;
    let subjectCount = 0;

    for (const subject of allSubjects) {
      const scores = subjectScoreMap.get(subject) ?? [];
      const assignmentsAvg = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      const examScores = examMap.get(subject);
      const examScore = examScores && examScores.length > 0
        ? Math.round(examScores.reduce((a, b) => a + b, 0) / examScores.length)
        : null;

      subjectRows.push({
        subject,
        assignmentsAvg,
        examScore,
        masteryPct: null,
        gradeLetter: gradeLetter(assignmentsAvg),
      });

      totalAvgSum += assignmentsAvg;
      subjectCount++;
    }

    const overallAvg = subjectCount > 0 ? Math.round(totalAvgSum / subjectCount) : 0;

    // --- Lesson completion from StudentProgress (userId = student.user.id) ---
    const progressRows = await prisma.studentProgress.findMany({
      where: {
        studentId: student.user.id,
        completedAt: { not: null, gte: startDate, lte: endDate },
      },
      include: {
        scheduledWork: {
          include: { content: { select: { subject: true } } },
        },
      },
    });

    const lessonBySubject = new Map<string, number>();
    for (const p of progressRows) {
      const subj = String(p.scheduledWork?.content?.subject ?? "OTHER");
      lessonBySubject.set(subj, (lessonBySubject.get(subj) ?? 0) + 1);
    }

    const totalCompleted = progressRows.length;

    // --- Teacher comment from ReportCard ---
    let teacherComment: string | null = null;
    if (termId) {
      const card = await prisma.reportCard.findUnique({
        where: { studentId_termId: { studentId, termId } },
        select: { teacherComment: true },
      });
      teacherComment = card?.teacherComment ?? null;
    }

    const today = new Date().toLocaleDateString("en-LR");
    const studentName = student.user.name ?? "Student";

    const data: ProgressReportData = {
      studentName,
      grade: student.currentGrade ?? null,
      termName,
      schoolName: school?.name ?? "LiberiaLearn School",
      generatedDate: today,
      attendance: {
        present: attPresent,
        absent: attAbsent,
        late: attLate,
        rate: attRate,
      },
      subjects: subjectRows,
      overallAvg,
      lessonCompletion: {
        total: totalCompleted,
        bySubject: Array.from(lessonBySubject.entries()).map(([subject, completed]) => ({
          subject,
          completed,
          total: completed,
        })),
      },
      teacherComment,
    };

    const element = React.createElement(ProgressReportDocument, { data });
    const buffer = await renderToBuffer(element as unknown as React.ReactElement);

    const safeName = studentName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const safeTerm = termName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().slice(0, 30);
    const filename = `progress-report-${safeName}-${safeTerm}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err: unknown) {
    console.error("[progress-report-pdf]", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
