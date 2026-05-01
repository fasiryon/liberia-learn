import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildTeacherClassPerformance } from "@/lib/reporting/teacherClassPerformance";
import { isAdaptiveEngineEnabled } from "@/lib/serverFlags";
import { buildClassIntelligence } from "@/lib/student/adaptiveRecommendations";
import { generateTeacherAlerts, getActiveTeacherAlerts } from "@/lib/intelligence/teacherAlerts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const classWhere =
      user.role === "ADMIN"
        ? { schoolId: user.schoolId! }
        : { schoolId: user.schoolId!, teacherId: user.id };

    const classes = await prisma.class.findMany({
      where: classWhere,
      select: { id: true, name: true },
    });
    const school =
      user.schoolId && (prisma as any).school
        ? await prisma.school.findUnique({
            where: { id: user.schoolId },
            select: { code: true, name: true },
          })
        : null;
    const classIds = classes.map((c) => c.id);
    const classPerformance =
      user.role === "TEACHER" && user.schoolId
        ? await buildTeacherClassPerformance(user.id, user.schoolId)
        : [];
    const classIntelligence = user.schoolId
      ? await buildClassIntelligence(classIds, user.schoolId).catch(() => null)
      : null;
    const adaptiveAttempts = isAdaptiveEngineEnabled()
      ? await (prisma as any).studentAdaptiveAttempt.findMany({
          where: {
            student: {
              user: {
                schoolId: user.schoolId!,
              },
            },
          },
          select: {
            studentId: true,
            strandCode: true,
            score: true,
          },
        })
      : [];

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const todayWork = await prisma.scheduledWork.findMany({
      where: { classId: { in: classIds }, scheduledDate: { gte: startOfDay, lt: endOfDay } },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            teacherId: true,
            Teacher: { select: { name: true } },
          },
        },
        content: {
          select: { payload: true },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    const completedCount =
      todayWork.length > 0
        ? await prisma.studentProgress.count({
            where: {
              scheduledWorkId: { in: todayWork.map((w) => w.id) },
              completedAt: { not: null },
            },
          })
        : 0;

    const totalStudents = await prisma.enrollment.count({ where: { classId: { in: classIds } } });
    const expectedCompletions =
      todayWork.length * Math.max(totalStudents / Math.max(classIds.length, 1), 1);
    const completionRate =
      expectedCompletions > 0 ? Math.round((completedCount / expectedCompletions) * 100) : 0;

    const todayProgress =
      todayWork.length > 0
        ? await prisma.studentProgress.findMany({
            where: { scheduledWorkId: { in: todayWork.map((work) => work.id) } },
            select: {
              scheduledWorkId: true,
              startedAt: true,
              completedAt: true,
              exitTicketScore: true,
            },
          })
        : [];

    const progressByWork = new Map<
      string,
      { started: number; completed: number; totalScore: number; scored: number }
    >();
    for (const progress of todayProgress) {
      const current = progressByWork.get(progress.scheduledWorkId) ?? {
        started: 0,
        completed: 0,
        totalScore: 0,
        scored: 0,
      };
      if (progress.startedAt || progress.completedAt) current.started += 1;
      if (progress.completedAt) current.completed += 1;
      if (typeof progress.exitTicketScore === "number") {
        current.totalScore += progress.exitTicketScore;
        current.scored += 1;
      }
      progressByWork.set(progress.scheduledWorkId, current);
    }

    const classesWithWork = new Set(todayWork.map((w) => w.classId));
    const classesWithoutLesson = classes
      .filter((c) => !classesWithWork.has(c.id))
      .map((c) => c.name);

    const assignmentsPendingGrading = await prisma.assignmentSubmission.count({
      where: {
        score: null,
        turnedInAt: { not: null },
        Assignment: {
          Class:
            user.role === "ADMIN"
              ? { schoolId: user.schoolId! }
              : { schoolId: user.schoolId!, teacherId: user.id },
        },
      },
    });

    const recentAssignments = await (prisma as any).assignment?.findMany?.({
      where:
        user.role === "ADMIN"
          ? { Class: { schoolId: user.schoolId! } }
          : { Class: { schoolId: user.schoolId!, teacherId: user.id } },
      include: {
        Class: {
          select: {
            enrollments: {
              select: {
                Student: {
                  select: {
                    id: true,
                    user: { select: { name: true, email: true } },
                  },
                },
              },
            },
          },
        },
        submissions: {
          select: { Student: { select: { id: true } }, turnedInAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }).catch(() => []) ?? [];

    const assignmentCompletionGaps = recentAssignments.map((assignment) => {
      const submittedStudentIds = new Set(
        assignment.submissions
          .filter((submission) => submission.turnedInAt)
          .map((submission) => submission.Student.id)
      );
      const affectedStudents = assignment.Class.enrollments
        .filter((enrollment) => !submittedStudentIds.has(enrollment.Student.id))
        .map((enrollment) => ({
          studentId: enrollment.Student.id,
          name:
            enrollment.Student.user.name ??
            enrollment.Student.user.email ??
            "Student",
        }));
      return {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        missedCount: affectedStudents.length,
        affectedStudents,
      };
    });

    const labsPendingReview =
      classIds.length > 0
        ? await prisma.labSession.count({
            where: {
              schoolId: user.schoolId!,
              score: null,
              scheduledWorkId: { in: todayWork.map((work) => work.id) },
            },
          })
        : 0;

    const recentLessons = await prisma.curriculumContent.findMany({
      where: { status: "APPROVED" },
      select: { contentId: true, payload: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const adaptiveGroups = new Map<
      string,
      { studentId: string; strandCode: string; totalScore: number; count: number }
    >();
    for (const attempt of adaptiveAttempts as Array<{
      studentId: string;
      strandCode: string;
      score: number;
    }>) {
      const key = `${attempt.studentId}::${attempt.strandCode}`;
      const current = adaptiveGroups.get(key) ?? {
        studentId: attempt.studentId,
        strandCode: attempt.strandCode,
        totalScore: 0,
        count: 0,
      };
      current.totalScore += attempt.score;
      current.count += 1;
      adaptiveGroups.set(key, current);
    }

    const groupedAdaptive = [...adaptiveGroups.values()].map((entry) => ({
      studentId: entry.studentId,
      strandCode: entry.strandCode,
      averageScore: entry.totalScore / Math.max(entry.count, 1),
    }));
    const gaps = groupedAdaptive.filter((entry) => entry.averageScore < 0.7);
    const studentsWithGaps = new Set(gaps.map((entry) => entry.studentId)).size;
    const avgMasteryScore =
      groupedAdaptive.length > 0
        ? Math.round(
            (groupedAdaptive.reduce((sum, entry) => sum + entry.averageScore, 0) /
              groupedAdaptive.length) *
              100
          ) / 100
        : 0;
    const topWeakStrands = [...gaps]
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3)
      .map((entry) => entry.strandCode);

    // Generate teacher alerts from class signals, then fetch active ones
    const atRiskStudents = classPerformance.flatMap((cls) =>
      cls.atRiskStudents.map((s) => ({
        studentId: s.studentId,
        name: s.name,
        classId: s.classId,
        className: s.className,
        daysSinceActivity: s.daysSinceActivity,
        profileHref: s.profileHref,
      }))
    );

    if (process.env.ENABLE_TEACHER_INTERVENTION_ALERTS !== "false") {
      await generateTeacherAlerts(user.id, user.schoolId ?? "", {
        atRiskStudents,
        interventionRecommendations: classIntelligence?.interventionRecommendations ?? [],
        weakLessons: classIntelligence?.weakLessons ?? [],
        pacingSignalSummaries: classIntelligence?.pacingSignalSummaries ?? [],
        weakTopicSequenceSummaries: classIntelligence?.weakTopicSequenceSummaries ?? [],
        classIds,
        assignmentCompletionGaps,
        classAverageDrops: classPerformance
          .filter((cls) => typeof cls.averageQuizScore === "number" && cls.averageQuizScore < 60)
          .map((cls) => ({
            classId: cls.classId,
            className: cls.className,
            subject: cls.subject,
            currentAverage: cls.averageQuizScore ?? 0,
            previousAverage: Math.min(100, (cls.averageQuizScore ?? 0) + 12),
          })),
      }).catch(() => null);
    }

    const teacherAlerts = user.schoolId
      ? await getActiveTeacherAlerts(user.id, user.schoolId).catch(() => [])
      : [];

    return NextResponse.json({
      scheduledToday: todayWork.length,
      completionRateToday: completionRate,
      assignmentsPendingGrading,
      labsPendingReview,
      classesWithoutLesson,
      todayLessons: todayWork.map((work) => {
        const progress = progressByWork.get(work.id) ?? {
          started: 0,
          completed: 0,
          totalScore: 0,
          scored: 0,
        };
        return {
          id: work.id,
          title: (work.content.payload as any)?.title || work.contentId,
          className: work.class.name,
          teacherName: work.class.Teacher?.name ?? "Teacher",
          durationMinutes: String(work.classFormat ?? "").startsWith("block") ? 90 : 45,
          status: work.isDelivered ? "delivered" : "pending",
          startedCount: progress.started,
          completedCount: progress.completed,
          averageExitTicketScore:
            progress.scored > 0 ? Math.round(progress.totalScore / progress.scored) : null,
        };
      }),
      recentLessons: recentLessons.map((l) => ({
        contentId: l.contentId,
        title: (l.payload as any)?.title || l.contentId,
        status: l.status,
        createdAt: l.createdAt,
      })),
      adaptiveStats: {
        studentsWithGaps,
        totalGapsDetected: gaps.length,
        avgMasteryScore,
        topWeakStrands,
      },
      classPerformance,
      classIntelligence,
      teacherAlerts,
      schoolCode: school?.code ?? null,
      schoolName: school?.name ?? null,
    });
  } catch (err: any) {
    console.error("[teacher.dashboard.GET]", err);
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
