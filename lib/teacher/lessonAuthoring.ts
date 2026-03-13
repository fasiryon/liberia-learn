import { slugify } from "@/lib/curriculum-helpers";
import { prisma } from "@/lib/db";

export type TeacherOwnedClass = {
  id: string;
  name: string;
  subject: string;
  schoolId: string;
  teacherId: string | null;
  enrollments: Array<{ Student: { currentGrade: number | null } }>;
};

export function inferClassGrade(
  enrollments: Array<{ Student: { currentGrade: number | null } }>
): number | null {
  const counts = new Map<number, number>();

  for (const enrollment of enrollments) {
    const grade = enrollment.Student.currentGrade;
    if (!grade) continue;
    counts.set(grade, (counts.get(grade) ?? 0) + 1);
  }

  let winner: number | null = null;
  let maxCount = -1;
  for (const [grade, count] of counts.entries()) {
    if (count > maxCount) {
      winner = grade;
      maxCount = count;
    }
  }

  return winner;
}

export async function getTeacherClassOrThrow(
  userId: string,
  classId: string
): Promise<TeacherOwnedClass> {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      subject: true,
      schoolId: true,
      teacherId: true,
      enrollments: {
        select: {
          Student: {
            select: {
              currentGrade: true,
            },
          },
        },
      },
    },
  });

  if (!classRecord || classRecord.teacherId !== userId) {
    throw Object.assign(new Error("Class does not belong to this teacher"), {
      status: 403,
    });
  }

  return classRecord;
}

export function buildTeacherContentId(classId: string, title: string): string {
  return `teacher-${classId}-${slugify(title)}-${Date.now()}`;
}

export function deriveAssessmentQuestions(payload: {
  objectives?: string[];
  activities?: string[];
  deliveryProfile?: {
    exitTicket?: {
      questions?: Array<{ question?: string | null }>;
    };
    estimatedMinutes?: number | null;
  } | null;
}): string[] {
  const exitTicketQuestions =
    payload.deliveryProfile?.exitTicket?.questions
      ?.map((question) => question.question?.trim() ?? "")
      .filter(Boolean) ?? [];

  if (exitTicketQuestions.length > 0) {
    return exitTicketQuestions;
  }

  const objectiveQuestions =
    payload.objectives?.map((objective) => `Explain: ${objective}`) ?? [];
  const activityQuestions =
    payload.activities?.slice(0, 2).map((activity) => `How would you apply this lesson during ${activity}?`) ?? [];

  return [...objectiveQuestions, ...activityQuestions].slice(0, 4);
}

export function deriveEstimatedMinutes(payload: {
  body?: string;
  deliveryProfile?: {
    estimatedMinutes?: number | null;
  } | null;
}): number {
  const explicit = payload.deliveryProfile?.estimatedMinutes;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const wordCount = (payload.body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(15, Math.min(90, Math.ceil(wordCount / 12)));
}
