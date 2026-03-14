import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const where =
      user.role === "ADMIN"
        ? {
            Assignment: {
              Class: {
                schoolId: user.schoolId,
              },
            },
          }
        : {
            Assignment: {
              Class: {
                schoolId: user.schoolId,
                teacherId: user.id,
              },
            },
          };

    const submissions = await prisma.assignmentSubmission.findMany({
      where,
      include: {
        Assignment: {
          select: {
            id: true,
            title: true,
            points: true,
            dueAt: true,
            Class: {
              select: {
                id: true,
                name: true,
                subject: true,
              },
            },
          },
        },
        Student: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ score: "asc" }, { turnedInAt: "desc" }],
    });

    return NextResponse.json({
      submissions: submissions.map((submission) => ({
        id: submission.id,
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.Assignment.title,
        className: submission.Assignment.Class.name,
        subject: String(submission.Assignment.Class.subject),
        points: submission.Assignment.points,
        dueAt: submission.Assignment.dueAt?.toISOString() ?? null,
        studentId: submission.studentId,
        studentName: submission.Student.user.name ?? submission.Student.user.email ?? "Student",
        submittedAt: submission.turnedInAt?.toISOString() ?? null,
        score: submission.score,
        feedback: submission.feedback ?? "",
        content: submission.content ?? "",
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load assignments" }, { status: err?.status ?? 500 });
  }
}
