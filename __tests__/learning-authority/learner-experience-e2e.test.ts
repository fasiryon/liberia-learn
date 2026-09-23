import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ rows: [] as Record<string, any>[] }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ id: "user-e2e", schoolId: "school-e2e", role: "STUDENT" })) }));
vi.mock("@/lib/db", () => {
  const learningEvent = {
    findFirst: vi.fn(async ({ where }: any) => store.rows.filter((row) => row.eventType === where.eventType &&
      row.schoolId === where.schoolId && row.studentId === where.studentId && row.userId === where.userId &&
      ["TEACHER", "ADMIN"].includes(row.actorRole)).at(-1) ?? null),
    findMany: vi.fn(async ({ where }: any) => store.rows.filter((row) => {
      if (where.id?.in) return where.id.in.includes(row.id);
      if (where.eventType && row.eventType !== where.eventType) return false;
      if (where.source && row.source !== where.source) return false;
      if (where.schoolId && row.schoolId !== where.schoolId) return false;
      if (where.studentId && row.studentId !== where.studentId) return false;
      if (where.userId && row.userId !== where.userId) return false;
      if (where.occurredAt?.lte && row.occurredAt > where.occurredAt.lte) return false;
      return true;
    })),
    count: vi.fn(async ({ where }: any) => store.rows.filter((row) => row.eventType === where.eventType &&
      row.source === where.source && row.schoolId === where.schoolId && row.studentId === where.studentId &&
      row.userId === where.userId && row.metadata?.canonicalEvent?.scope?.ontologyReleaseIdentity === where.metadata?.equals).length),
    create: vi.fn(async ({ data }: any) => {
      if (store.rows.some((row) => row.id === data.id)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
      const row = { ...data, occurredAt: data.occurredAt ?? new Date() };
      store.rows.push(row);
      return row;
    }),
    findUnique: vi.fn(async ({ where }: any) => store.rows.find((row) => row.id === where.id) ?? null),
  };
  return { prisma: {
    student: { findFirst: vi.fn(async () => ({ id: "student-e2e", currentGrade: 4 })) },
    curriculumContent: { findFirst: vi.fn(async () => ({ contentId: "ll-g4-math-fractions-equal-parts-2026.1" })) },
    learningEvent,
    $transaction: vi.fn(async (callback: any) => callback({ learningEvent })),
  } };
});

import { GET, POST } from "@/app/api/student/learning-authority/next-action/route";

describe("governed learner loop through the real decision and state services", () => {
  beforeEach(() => { store.rows.length = 0; });

  it("persists the decision, admits server-scored evidence, updates state, and advances to practice", async () => {
    const issued = await GET();
    expect(issued.status).toBe(200);
    const first = await issued.json();
    expect(first.action.kind).toBe("DIAGNOSTIC");
    expect(first.releaseIdentity).toMatch(/^[a-f0-9]{64}$/);
    expect(first.item.correctIndex).toBeUndefined();
    expect(store.rows.filter((row) => row.eventType === "learning.decision.v1")).toHaveLength(1);

    const submitted = await POST(new NextRequest("http://localhost/api/student/learning-authority/next-action", {
      method: "POST", headers: { "Content-Type": "application/json", cookie: issued.headers.get("set-cookie") ?? "" },
      body: JSON.stringify({ decisionId: first.decisionId, sessionId: first.sessionId,
        itemId: first.item.id, itemVersion: first.item.version, answerIndex: 2 }),
    }));
    expect(submitted.status).toBe(200);
    const outcome = await submitted.json();
    expect(outcome.correct).toBe(true);
    expect(outcome.learnerState.mastery.observedScore).toBe(1);
    expect(store.rows.filter((row) => row.eventType === "learning.canonical.mastery_update.v1")).toHaveLength(1);

    const next = await GET();
    const second = await next.json();
    expect(second.decisionId).not.toBe(first.decisionId);
    expect(second.action.kind).toBe("PRACTICE");
    expect(second.item.id).toBe("g4-frac-practice-equivalence");

    const practiced = await POST(new NextRequest("http://localhost/api/student/learning-authority/next-action", {
      method: "POST", headers: { "Content-Type": "application/json", cookie: next.headers.get("set-cookie") ?? "" },
      body: JSON.stringify({ decisionId: second.decisionId, sessionId: second.sessionId,
        itemId: second.item.id, itemVersion: second.item.version, answerIndex: 1 }),
    }));
    expect(practiced.status).toBe(200);
    expect((await practiced.json()).correct).toBe(true);
    const probe = await POST(new NextRequest("http://localhost/api/student/learning-authority/next-action", {
      method: "POST", headers: { "Content-Type": "application/json", cookie: next.headers.get("set-cookie") ?? "" },
      body: JSON.stringify({ decisionId: second.decisionId, sessionId: second.sessionId,
        itemId: second.item.id, itemVersion: second.item.version, answerIndex: 0 }),
    }));
    expect(probe.status).toBe(409);
    expect((await probe.json()).correct).toBeUndefined();
    const final = await (await GET()).json();
    expect(final.action.kind).toBe("DIAGNOSTIC");
    expect(final.item.id).toBe("g4-frac-diagnostic-compare");
    expect(store.rows.filter((row) => row.eventType === "learning.canonical.mastery_update.v1")).toHaveLength(2);
  });
});
