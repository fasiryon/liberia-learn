import { prisma } from "@/lib/db";

export async function getAdminStudentDetail(studentId: string, schoolId: string) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      user: { schoolId },
    },
    include: {
      user: {
        include: {
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      enrollments: {
        include: {
          Class: {
            select: {
              id: true,
              name: true,
              subject: true,
            },
          },
        },
      },
      placementTests: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          estimatedGrade: true,
          teacherGrade: true,
          teacherDecision: true,
          levelLabel: true,
          rawScore: true,
          totalQuestions: true,
        },
      },
      examAttempts: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: {
          exam: {
            select: {
              id: true,
              title: true,
              subject: true,
              grade: true,
            },
          },
        },
      },
      assignmentSubmissions: {
        orderBy: { turnedInAt: "desc" },
        take: 10,
        include: {
          Assignment: {
            include: {
              Class: {
                select: {
                  id: true,
                  name: true,
                  subject: true,
                },
              },
            },
          },
        },
      },
      guardians: {
        include: {
          guardian: {
            select: {
              id: true,
              name: true,
              email: true,
              guardianPhoneE164: true,
            },
          },
        },
      },
      interventionRecommendations: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          recommendationType: true,
          reason: true,
          confidenceScore: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!student) return null;

  const lessonCompletions = await prisma.studentProgress.findMany({
    where: {
      studentId: student.userId,
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    take: 10,
    include: {
      scheduledWork: {
        include: {
          class: {
            select: {
              id: true,
              name: true,
              subject: true,
            },
          },
          content: {
            select: {
              contentId: true,
              payload: true,
            },
          },
        },
      },
    },
  });

  return {
    id: student.id,
    userId: student.userId,
    name: student.user.name ?? student.user.email ?? "Student",
    email: student.user.email,
    grade: student.currentGrade,
    school: student.user.school
      ? {
          id: student.user.school.id,
          name: student.user.school.name,
        }
      : null,
    classes: student.enrollments.map((enrollment) => ({
      id: enrollment.Class.id,
      name: enrollment.Class.name,
      subject: String(enrollment.Class.subject),
    })),
    latestPlacement: student.placementTests[0]
      ? {
          id: student.placementTests[0].id,
          estimatedGrade: student.placementTests[0].estimatedGrade,
          teacherGrade: student.placementTests[0].teacherGrade,
          teacherDecision: student.placementTests[0].teacherDecision,
          levelLabel: student.placementTests[0].levelLabel,
          rawScore: student.placementTests[0].rawScore,
          totalQuestions: student.placementTests[0].totalQuestions,
          createdAt: student.placementTests[0].createdAt.toISOString(),
        }
      : null,
    recentLessonCompletions: lessonCompletions.map((progress) => ({
      id: progress.id,
      completedAt: progress.completedAt?.toISOString() ?? null,
      exitTicketScore: progress.exitTicketScore,
      className: progress.scheduledWork.class.name,
      subject: String(progress.scheduledWork.class.subject),
      lessonTitle:
        typeof (progress.scheduledWork.content.payload as { title?: unknown })?.title === "string"
          ? ((progress.scheduledWork.content.payload as { title: string }).title)
          : progress.scheduledWork.content.contentId,
    })),
    examAttempts: student.examAttempts.map((attempt) => ({
      id: attempt.id,
      title: attempt.exam.title,
      subject: attempt.exam.subject,
      score: attempt.score,
      passed: attempt.passed,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
    })),
    assignmentSubmissions: student.assignmentSubmissions.map((submission) => ({
      id: submission.id,
      title: submission.Assignment.title,
      className: submission.Assignment.Class.name,
      subject: String(submission.Assignment.Class.subject),
      score: submission.score,
      turnedInAt: submission.turnedInAt?.toISOString() ?? null,
      gradedAt: submission.gradedAt?.toISOString() ?? null,
    })),
    guardians: student.guardians.map((guardianLink) => ({
      id: guardianLink.guardian.id,
      name: guardianLink.guardian.name ?? guardianLink.guardian.email ?? "Guardian",
      email: guardianLink.guardian.email,
      phone: guardianLink.guardian.guardianPhoneE164,
      relation: guardianLink.relation ?? "Guardian",
    })),
    interventionFlags: student.interventionRecommendations.map((flag) => ({
      id: flag.id,
      type: flag.recommendationType,
      reason: flag.reason,
      confidenceScore: flag.confidenceScore,
      status: flag.status,
      createdAt: flag.createdAt.toISOString(),
    })),
  };
}
