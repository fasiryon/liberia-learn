import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const previousCount = Number(req.nextUrl.searchParams.get("previousCount") ?? "NaN");
    const source = req.nextUrl.searchParams.get("source") ?? "page";

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        enrollments: { select: { classId: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const classIds = student.enrollments.map((e) => e.classId);

    if (classIds.length === 0) {
      return NextResponse.json({
        assignments: [],
        count: 0,
        newCount: 0,
        serverTime: new Date().toISOString(),
      });
    }

    const assignments = await prisma.assignment.findMany({
      where: { classId: { in: classIds } },
      include: {
        Class: { select: { id: true, name: true, subject: true } },
        submissions: {
          where: { studentId: student.id },
          take: 1,
          select: { id: true, score: true, turnedInAt: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    });

    const newCount = Number.isFinite(previousCount)
      ? Math.max(0, assignments.length - previousCount)
      : 0;

    if (source === "poll" && Number.isFinite(previousCount) && previousCount !== assignments.length) {
      logLearningEvent({
        schoolId: user.schoolId,
        userId: user.id,
        studentId: student.id,
        actor: { type: "student", id: user.id, role: "STUDENT" },
        eventType: "assignment_list_polled",
        source: "/api/student/assignments",
        metadata: { assignmentCount: assignments.length, newCount },
      }).catch(() => null);
    }

    const now = Date.now();
    const THIRTY_MIN_MS = 30 * 60 * 1000;

    return NextResponse.json({
      assignments: assignments.map((a) => {
        const submission = a.submissions[0] ?? null;
        const isNew = now - a.createdAt.getTime() < THIRTY_MIN_MS;
        const isOverdue =
          a.dueAt !== null &&
          new Date(a.dueAt) < new Date() &&
          !submission?.turnedInAt;
        return {
          id: a.id,
          title: a.title,
          description: a.description ?? "",
          classId: a.classId,
          className: a.Class.name,
          subject: String(a.Class.subject),
          dueAt: a.dueAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          points: a.points,
          isNew,
          isOverdue,
          submission: submission
            ? {
                id: submission.id,
                score: submission.score,
                turnedInAt: submission.turnedInAt?.toISOString() ?? null,
              }
            : null,
        };
      }),
      count: assignments.length,
      newCount,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load assignments" },
      { status: err?.status ?? 500 }
    );
  }
}
