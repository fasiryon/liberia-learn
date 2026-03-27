import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export type AudienceScopeInput = {
  subject?: string | null;
  grade?: number | null;
  gradeLevel?: string | number | null;
  invalidSubjectBehavior?: "reject" | "fallback";
};

export type AudienceScope = {
  grade: number | null;
  gradeLevel: string | null;
  subject: string | null;
  allowedGrades?: number[];
  allowedSubjects?: string[];
};

type GuardianStudentScope = {
  grade: number;
  subjects: string[];
};

function parseRequestedGrade(input: AudienceScopeInput): number | null {
  if (typeof input.grade === "number" && Number.isFinite(input.grade)) {
    return input.grade;
  }

  if (typeof input.gradeLevel === "number" && Number.isFinite(input.gradeLevel)) {
    return input.gradeLevel;
  }

  if (typeof input.gradeLevel === "string") {
    const match = input.gradeLevel.match(/\d+/);
    if (!match) {
      return null;
    }

    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function resolveAssistantAudienceScope(
  user: Pick<SessionUser, "id" | "role">,
  input: AudienceScopeInput
): Promise<AudienceScope> {
  const requestedGrade = parseRequestedGrade(input);

  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
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

    const allowedSubjects = Array.from(
      new Set(
        (student?.enrollments ?? [])
          .map((enrollment) => String(enrollment.Class.subject))
          .filter(Boolean)
      )
    );
    const grade = student?.currentGrade ?? null;

    if (typeof grade !== "number" || allowedSubjects.length === 0) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    if (
      input.subject &&
      !allowedSubjects.includes(input.subject) &&
      (input.invalidSubjectBehavior ?? "reject") === "reject"
    ) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    return {
      grade,
      gradeLevel: String(grade),
      subject:
        input.subject && !allowedSubjects.includes(input.subject)
          ? allowedSubjects[0] ?? null
          : input.subject ?? null,
      allowedGrades: [grade],
      allowedSubjects,
    };
  }

  if (user.role === "GUARDIAN") {
    const guardian = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        guardianOf: {
          select: {
            student: {
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
            },
          },
        },
      },
    });

    const studentScopes = (guardian?.guardianOf ?? [])
      .map((link) => {
        const grade = link.student.currentGrade;
        const subjects = Array.from(
          new Set(
            link.student.enrollments
              .map((enrollment) => String(enrollment.Class.subject))
              .filter(Boolean)
          )
        );

        if (typeof grade !== "number" || subjects.length === 0) {
          return null;
        }

        return {
          grade,
          subjects,
        } satisfies GuardianStudentScope;
      })
      .filter((scope): scope is GuardianStudentScope => scope !== null);

    const allowedGrades = Array.from(
      new Set(studentScopes.map((scope) => scope.grade))
    );
    const allowedSubjects = Array.from(
      new Set(studentScopes.flatMap((scope) => scope.subjects))
    );

    if (studentScopes.length === 0) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const matchesRequestedScope = studentScopes.some((scope) => {
      if (requestedGrade != null && scope.grade !== requestedGrade) {
        return false;
      }

      if (input.subject && !scope.subjects.includes(input.subject)) {
        return false;
      }

      return true;
    });

    if (
      (requestedGrade != null || input.subject != null) &&
      !matchesRequestedScope
    ) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    return {
      grade: requestedGrade,
      gradeLevel: requestedGrade != null ? String(requestedGrade) : null,
      subject: input.subject ?? null,
      allowedGrades,
      allowedSubjects,
    };
  }

  return {
    grade: requestedGrade,
    gradeLevel: requestedGrade != null ? String(requestedGrade) : null,
    subject: input.subject ?? null,
  };
}
