import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

function escapeCsv(value: string | number | null) {
  if (value == null) {
    return "";
  }

  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: {
        Class: {
          select: {
            schoolId: true,
            teacherId: true,
            name: true,
            enrollments: {
              select: {
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
            },
          },
        },
        submissions: {
          select: {
            studentId: true,
            turnedInAt: true,
            score: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (assignment.Class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role !== "ADMIN" && assignment.Class.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const submissionsByStudentId = new Map(
      assignment.submissions.map((submission) => [submission.studentId, submission] as const)
    );

    const rows = assignment.Class.enrollments.map((enrollment) => {
      const submission = submissionsByStudentId.get(enrollment.Student.id);
      const name = enrollment.Student.user.name ?? enrollment.Student.user.email ?? "Student";
      return [
        name,
        submission?.turnedInAt ? "Completed" : "Not completed",
        submission?.turnedInAt ? new Date(submission.turnedInAt).toISOString() : "",
        typeof submission?.score === "number" ? submission.score : "",
      ]
        .map((value) => escapeCsv(value))
        .join(",");
    });

    const csv = [["Student Name", "Status", "Completed At", "Score"].join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="assignment-${assignment.id}-completion.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to export assignment completions" },
      { status: error?.status ?? 500 }
    );
  }
}
