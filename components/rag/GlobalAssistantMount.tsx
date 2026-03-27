import { getOptionalUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRagTutorEnabled } from "@/lib/serverFlags";
import { getAssistantRoleConfig } from "@/lib/ai/rag/assistantAccess";
import GlobalAssistantShell from "@/components/rag/GlobalAssistantShell";

type LearnerScope = {
  id: string;
  label: string;
  grade: number | null;
  subjects: string[];
};

type LearningContext = {
  grade: number | null;
  subjects: string[];
  learners?: LearnerScope[];
};

async function getUserLearningContext(
  userId: string,
  role: string
): Promise<LearningContext> {
  if (role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: {
        currentGrade: true,
        enrollments: {
          select: {
            Class: {
              select: {
                subject: true,
              },
            },
          },
        },
      },
    });

    return {
      grade: student?.currentGrade ?? null,
      subjects: Array.from(
        new Set(
          (student?.enrollments ?? [])
            .map((enrollment) => String(enrollment.Class.subject))
            .filter(Boolean)
        )
      ).sort(),
    };
  }

  if (role === "GUARDIAN") {
    const guardian = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        guardianOf: {
          select: {
            student: {
              select: {
                id: true,
                currentGrade: true,
                user: {
                  select: {
                    name: true,
                  },
                },
                enrollments: {
                  select: {
                    Class: {
                      select: {
                        subject: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const learners = (guardian?.guardianOf ?? []).map((link, index) => ({
      id: link.student.id,
      label:
        link.student.user.name?.trim() || `Child ${index + 1}`,
      grade:
        typeof link.student.currentGrade === "number"
          ? link.student.currentGrade
          : null,
      subjects: Array.from(
        new Set(
          link.student.enrollments
            .map((enrollment) => String(enrollment.Class.subject))
            .filter(Boolean)
        )
      ).sort(),
    })).filter((learner) => learner.subjects.length > 0 || learner.grade != null);
    const firstLearner = learners[0] ?? null;

    return {
      grade: firstLearner?.grade ?? null,
      subjects: firstLearner?.subjects ?? [],
      learners,
    };
  }

  return {
    grade: null,
    subjects: [] as string[],
  };
}

type Props = {
  positionClassName?: string;
};

export default async function GlobalAssistantMount({ positionClassName }: Props) {
  if (!isRagTutorEnabled()) {
    return null;
  }

  const user = await getOptionalUser();
  if (!user) {
    return null;
  }

  const roleConfig = getAssistantRoleConfig(user.role);
  if (!roleConfig) {
    return null;
  }

  const learningContext = await getUserLearningContext(user.id, user.role);

  return (
    <GlobalAssistantShell
      roleConfig={roleConfig}
      initialGrade={learningContext.grade}
      suggestedSubjects={learningContext.subjects}
      guardianLearners={learningContext.learners}
      positionClassName={positionClassName}
      contextStorageKey="liberialearn:assistant-context"
    />
  );
}
