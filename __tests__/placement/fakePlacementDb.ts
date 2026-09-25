import { Prisma } from "@prisma/client";

/**
 * Minimal in-memory stand-in for the placement tables. It enforces the same
 * unique constraints as the migration (item sequence per session, response
 * operation id, one PlacementTest per session, one decision per placement)
 * and the write-once item response trigger.
 */
export function createFakePlacementDb() {
  let seq = 0;
  const id = (prefix: string) => `${prefix}-${++seq}`;
  const unique = (target: string) =>
    new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${target}`, {
      code: "P2002",
      clientVersion: "test",
    });

  const state = {
    students: [] as any[],
    users: [] as any[],
    sessions: [] as any[],
    items: [] as any[],
    placements: [] as any[],
    reviews: [] as any[],
    decisions: [] as any[],
  };

  const matches = (row: any, where: any): boolean =>
    Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if ("lte" in value) return row[key] <= value.lte;
        if ("in" in value) return value.in.includes(row[key]);
        if ("not" in value) return row[key] !== value.not;
        if (key === "user") {
          const user = state.users.find((u) => u.id === row.userId);
          return !!user && matches(user, value);
        }
        return false;
      }
      return row[key] === value;
    });

  const itemsFor = (sessionId: string) =>
    state.items.filter((item) => item.sessionId === sessionId).sort((a, b) => a.sequence - b.sequence);

  const db: any = {
    student: {
      findFirst: async ({ where }: any) => state.students.find((s) => matches(s, where)) ?? null,
      update: async ({ where, data }: any) => {
        const student = state.students.find((s) => s.id === where.id);
        Object.assign(student, data);
        return student;
      },
    },
    placementSession: {
      findFirst: async ({ where, include }: any) => {
        const rows = state.sessions.filter((s) => matches(s, where)).sort((a, b) => b.createdAt - a.createdAt);
        const row = rows[0];
        if (!row) return null;
        return include?.items ? { ...row, items: itemsFor(row.id) } : { ...row };
      },
      count: async ({ where }: any) => state.sessions.filter((s) => matches(s, where)).length,
      findMany: async ({ where }: any) => state.sessions.filter((s) => matches(s, where)).map((s) => ({ ...s })),
      create: async ({ data }: any) => {
        if (state.sessions.some((s) => s.studentId === data.studentId && s.status === "ACTIVE")) {
          throw unique("PlacementSession_one_active_per_student_key");
        }
        const row = { id: id("session"), status: "ACTIVE", completedAt: null, placementTestId: null, createdAt: new Date(), ...data };
        state.sessions.push(row);
        return { ...row };
      },
      updateMany: async ({ where, data }: any) => {
        const rows = state.sessions.filter((s) => matches(s, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    placementSessionItem: {
      create: async ({ data }: any) => {
        if (state.items.some((i) => i.sessionId === data.sessionId && i.sequence === data.sequence)) {
          throw unique("sessionId,sequence");
        }
        const row = { id: id("item"), selectedIndex: null, isCorrect: null, responseOperationId: null, respondedAt: null, issuedAt: new Date(), ...data };
        state.items.push(row);
        return { ...row };
      },
      findMany: async ({ where }: any) => state.items.filter((i) => matches(i, where)).map((i) => ({ ...i })),
      findFirst: async ({ where }: any) =>
        state.items.filter((i) => matches(i, where)).sort((a, b) => a.sequence - b.sequence)[0] ?? null,
      findUnique: async ({ where }: any) => {
        const row = state.items.find((i) => i.id === where.id);
        return row ? { ...row } : null;
      },
      updateMany: async ({ where, data }: any) => {
        if (data.responseOperationId && state.items.some((i) => i.responseOperationId === data.responseOperationId)) {
          throw unique("responseOperationId");
        }
        const rows = state.items.filter((i) => matches(i, where));
        rows.forEach((row) => {
          if (row.respondedAt) throw new Error("PlacementSessionItem response is write-once");
          Object.assign(row, data);
        });
        return { count: rows.length };
      },
    },
    placementTest: {
      create: async ({ data }: any) => {
        if (data.sessionId && state.placements.some((p) => p.sessionId === data.sessionId)) throw unique("sessionId");
        const row = { id: id("placement"), createdAt: new Date(), teacherDecision: null, ...data };
        state.placements.push(row);
        return { ...row };
      },
      findUnique: async ({ where, include }: any) => {
        const row = state.placements.find((p) => (where.id ? p.id === where.id : p.sessionId === where.sessionId));
        if (!row) return null;
        if (!include) return { ...row };
        const student = state.students.find((s) => s.id === row.studentId);
        const user = state.users.find((u) => u.id === student.userId);
        return {
          ...row,
          decision: state.decisions.find((d) => d.placementTestId === row.id) ?? null,
          student: { ...student, guardians: [], user: { ...user, school: { name: "Test School" } } },
        };
      },
      update: async ({ where, data }: any) => {
        const row = state.placements.find((p) => p.id === where.id);
        Object.assign(row, data);
        return { ...row };
      },
    },
    placementReview: {
      create: async ({ data }: any) => {
        const row = { id: id("review"), createdAt: new Date(), ...data };
        state.reviews.push(row);
        return row;
      },
    },
    placementDecision: {
      create: async ({ data }: any) => {
        if (state.decisions.some((d) => d.placementTestId === data.placementTestId)) throw unique("placementTestId");
        const row = { id: id("decision"), createdAt: new Date(), ...data };
        state.decisions.push(row);
        return row;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
  };

  function addLearner(opts: { userId: string; studentId: string; schoolId: string; currentGrade?: number }) {
    state.users.push({ id: opts.userId, schoolId: opts.schoolId, name: `Learner ${opts.userId}`, guardianPhoneE164: null });
    state.students.push({ id: opts.studentId, userId: opts.userId, currentGrade: opts.currentGrade ?? 4 });
  }

  return { db, state, addLearner };
}
