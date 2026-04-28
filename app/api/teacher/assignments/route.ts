import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAssignmentCreated } from "@/lib/assignment-notifications";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { assignmentCreateSchema } from "@/lib/schemas/assignment";

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

    const [submissions, assignments] = await Promise.all([
      prisma.assignmentSubmission.findMany({
        where,
        include: {
          Assignment: {
            select: {
              id: true,
              title: true,
              points: true,
              dueAt: true,
              createdAt: true,
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
        orderBy: [{ turnedInAt: "desc" }],
      }),
      prisma.assignment.findMany({
        where:
          user.role === "ADMIN"
            ? {
                Class: {
                  schoolId: user.schoolId,
                },
              }
            : {
                Class: {
                  schoolId: user.schoolId,
                  teacherId: user.id,
                },
              },
        include: {
          Class: {
            select: {
              id: true,
              name: true,
              subject: true,
              Teacher: {
                select: {
                  name: true,
                  email: true,
                },
              },
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
              id: true,
              score: true,
              turnedInAt: true,
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
        orderBy: [{ createdAt: "desc" }],
        take: 24,
      }),
    ]);

    return NextResponse.json({
      assignments: assignments.map((assignment) => {
        const submittedCount = assignment.submissions.filter((submission) => submission.turnedInAt).length;
        const gradedCount = assignment.submissions.filter((submission) => submission.score != null).length;
        const gradedScores = assignment.submissions
          .map((submission) => submission.score)
          .filter((score): score is number => typeof score === "number");
        const submittedStudentIds = new Set(
          assignment.submissions
            .filter((submission) => submission.turnedInAt)
            .map((submission) => submission.Student.id)
        );
        const pendingStudents = assignment.Class.enrollments
          .filter((enrollment) => !submittedStudentIds.has(enrollment.Student.id))
          .map((enrollment) => enrollment.Student.user.name ?? enrollment.Student.user.email ?? "Student");
        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description ?? "",
          classId: assignment.classId,
          className: assignment.Class.name,
          teacherName: assignment.Class.Teacher?.name ?? assignment.Class.Teacher?.email ?? "Teacher",
          subject: String(assignment.Class.subject),
          points: assignment.points,
          dueAt: assignment.dueAt?.toISOString() ?? null,
          createdAt: assignment.createdAt.toISOString(),
          submittedCount,
          completionCount: submittedCount,
          gradedCount,
          studentCount: assignment.Class.enrollments.length,
          averageScore:
            gradedScores.length > 0
              ? Math.round(
                  gradedScores.reduce((sum, score) => sum + score, 0) / gradedScores.length
                )
              : null,
          pendingStudents,
        };
      }),
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

export async function POST(req: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const parsed = assignmentCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid assignment payload." },
        { status: 400 }
      );
    }

    const { classId, scheduledWorkId, contentId, dueAt, ...rest } = parsed.data;

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        schoolId: true,
        teacherId: true,
      },
    });

    if (!cls) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }
    if (cls.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role !== "ADMIN" && cls.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let resolvedScheduledWorkId = scheduledWorkId;
    let resolvedContentId = contentId;

    if (scheduledWorkId) {
      const scheduledWork = await prisma.scheduledWork.findUnique({
        where: { id: scheduledWorkId },
        select: {
          id: true,
          classId: true,
          contentId: true,
          class: {
            select: {
              schoolId: true,
            },
          },
        },
      });

      if (!scheduledWork || scheduledWork.class.schoolId !== user.schoolId) {
        return NextResponse.json({ error: "Scheduled work not found." }, { status: 404 });
      }
      if (scheduledWork.classId !== classId) {
        return NextResponse.json(
          { error: "Scheduled work must belong to the selected class." },
          { status: 400 }
        );
      }

      resolvedScheduledWorkId = scheduledWork.id;
      resolvedContentId = resolvedContentId ?? scheduledWork.contentId ?? undefined;
    }

    if (resolvedContentId) {
      const content = await prisma.curriculumContent.findUnique({
        where: { contentId: resolvedContentId },
        select: { contentId: true },
      });
      if (!content) {
        return NextResponse.json({ error: "Curriculum content not found." }, { status: 404 });
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        classId,
        title: rest.title,
        description: rest.description || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        points: rest.points,
        scheduledWorkId: resolvedScheduledWorkId ?? null,
        contentId: resolvedContentId ?? null,
        moeStandardCodes: rest.moeStandardCodes,
        generationMethod: rest.generationMethod,
      },
      include: {
        Class: {
          select: {
            id: true,
            name: true,
            subject: true,
            Teacher: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "assignment.created",
      resourceType: "assignment",
      resourceId: assignment.id,
      details: {
        classId: assignment.classId,
        className: cls.name,
        generationMethod: assignment.generationMethod ?? "manual",
      },
    });

    await logLearningEvent({
      schoolId: user.schoolId,
      classId: assignment.classId,
      userId: user.id,
      actor: { type: "user", id: user.id, role: user.role },
      target: { type: "assignment", id: assignment.id },
      eventType: "assignment.created",
      source: "/api/teacher/assignments",
      contentId: assignment.contentId ?? null,
      subject: String(assignment.Class.subject),
      metadata: {
        dueAt: assignment.dueAt?.toISOString() ?? null,
        generationMethod: assignment.generationMethod ?? "manual",
        points: assignment.points,
      },
    });

    await (prisma as any).teacherAction?.create?.({
      data: {
        teacherUserId: user.id,
        schoolId: user.schoolId,
        classId: assignment.classId,
        contentId: assignment.contentId ?? null,
        actionType: "assign_work",
        targetType: "assignment",
        targetId: assignment.id,
        subject: String(assignment.Class.subject),
        metadata: {
          generationMethod: assignment.generationMethod ?? "manual",
          dueAt: assignment.dueAt?.toISOString() ?? null,
        },
      },
    });

    await notifyAssignmentCreated({
      actorUserId: user.id,
      schoolId: user.schoolId,
      classId: assignment.classId,
      assignmentTitle: assignment.title,
      className: assignment.Class.name,
      teacherName: assignment.Class.Teacher?.name ?? assignment.Class.Teacher?.email ?? "Teacher",
      dueAt: assignment.dueAt,
    }).catch(() => null);

    return NextResponse.json(
      {
        ok: true,
        assignment: {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description ?? "",
          classId: assignment.classId,
          className: assignment.Class.name,
          subject: String(assignment.Class.subject),
          dueAt: assignment.dueAt?.toISOString() ?? null,
          points: assignment.points,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to create assignment" },
      { status: err?.status ?? 500 }
    );
  }
}
