import { prisma } from "@/lib/db";
import {
  mapLearningEventToXapi,
  mapStudentPerformanceEventToXapi,
  validateXapiStatement,
  type XapiStatement,
} from "@/lib/interoperability/xapi";

export type XapiExportSource = "all" | "learning" | "performance";

export type XapiExportInput = {
  schoolId: string;
  since: Date;
  until: Date;
  source: XapiExportSource;
  limit: number;
  pseudonymSecret: string;
};

function candidateActorId(event: {
  studentId?: string | null;
  userId?: string | null;
  actorId?: string | null;
}) {
  return event.studentId ?? event.userId ?? event.actorId ?? null;
}

export async function buildXapiExport(input: XapiExportInput): Promise<XapiStatement[]> {
  const includeLearning = input.source !== "performance";
  const includePerformance = input.source !== "learning";
  const [learningEvents, performanceEvents] = await Promise.all([
    includeLearning
      ? prisma.learningEvent.findMany({
          where: {
            schoolId: input.schoolId,
            occurredAt: { gte: input.since, lte: input.until },
            OR: [
              { studentId: { not: null } },
              { actorRole: { in: ["STUDENT", "student"] } },
            ],
          },
          select: {
            id: true,
            eventType: true,
            occurredAt: true,
            originalOccurredAt: true,
            userId: true,
            studentId: true,
            actorId: true,
            targetType: true,
            targetId: true,
            contentId: true,
            lessonId: true,
            status: true,
            curriculumVersion: true,
            promptVersion: true,
            assessmentVersion: true,
            calculationVersion: true,
            replayOfEventId: true,
            replaySequence: true,
            isReplay: true,
          },
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
          take: input.limit,
        })
      : Promise.resolve([]),
    includePerformance
      ? prisma.studentPerformanceEvent.findMany({
          where: {
            schoolId: input.schoolId,
            createdAt: { gte: input.since, lte: input.until },
            student: { user: { schoolId: input.schoolId } },
          },
          select: {
            id: true,
            studentId: true,
            lessonId: true,
            subject: true,
            gradeLevel: true,
            eventType: true,
            score: true,
            durationSeconds: true,
            attempts: true,
            aiAssistUsed: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: input.limit,
        })
      : Promise.resolve([]),
  ]);

  const actorCandidates = Array.from(
    new Set([
      ...learningEvents.map(candidateActorId),
      ...performanceEvents.map((event) => event.studentId),
    ].filter((value): value is string => Boolean(value)))
  );
  const students = actorCandidates.length > 0
    ? await prisma.student.findMany({
        where: {
          user: { schoolId: input.schoolId },
          OR: [{ id: { in: actorCandidates } }, { userId: { in: actorCandidates } }],
        },
        select: { id: true, userId: true },
      })
    : [];
  const canonicalActors = new Map<string, string>();
  for (const student of students) {
    canonicalActors.set(student.id, student.id);
    canonicalActors.set(student.userId, student.id);
  }

  const mapped = [
    ...learningEvents.map((event) => {
      const candidate = candidateActorId(event);
      return {
        timestamp: event.originalOccurredAt ?? event.occurredAt,
        statement: mapLearningEventToXapi(event, {
          pseudonymSecret: input.pseudonymSecret,
          actorIdentifier: candidate ? canonicalActors.get(candidate) ?? candidate : undefined,
        }),
      };
    }),
    ...performanceEvents.map((event) => ({
      timestamp: event.createdAt,
      statement: mapStudentPerformanceEventToXapi(event, {
        pseudonymSecret: input.pseudonymSecret,
        actorIdentifier: canonicalActors.get(event.studentId) ?? event.studentId,
      }),
    })),
  ]
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .slice(0, input.limit)
    .map((entry) => entry.statement);

  for (const statement of mapped) {
    const validation = validateXapiStatement(statement);
    if (!validation.valid) {
      throw new Error(`Generated xAPI statement failed validation: ${validation.errors.join("; ")}`);
    }
  }

  return mapped;
}
