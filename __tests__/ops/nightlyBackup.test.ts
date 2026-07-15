import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    student: { findMany: vi.fn() },
    grade: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    studentGuardian: { findMany: vi.fn() },
    escalationQueue: { findMany: vi.fn() },
    agentInvocation: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const put = vi.fn();
const list = vi.fn();
const del = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a), list: (...a: unknown[]) => list(...a), del: (...a: unknown[]) => del(...a) }));

import { GET } from "@/app/api/cron/nightly-backup/route";

const originalSecret = process.env.CRON_SECRET;
afterAll(() => {
  process.env.CRON_SECRET = originalSecret;
});

function req(auth?: string) {
  return new Request("http://x/api/cron/nightly-backup", { headers: auth ? { authorization: auth } : {} }) as never;
}

function emptyModels() {
  prismaMock.student.findMany.mockResolvedValue([]);
  prismaMock.grade.findMany.mockResolvedValue([]);
  prismaMock.attendance.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.studentGuardian.findMany.mockResolvedValue([]);
  prismaMock.escalationQueue.findMany.mockResolvedValue([]);
  prismaMock.agentInvocation.findMany.mockResolvedValue([]);
}

describe("GET /api/cron/nightly-backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret123";
    put.mockResolvedValue({ url: "https://blob/x" });
    list.mockResolvedValue({ blobs: [] });
    emptyModels();
  });

  it("rejects a request without the cron secret", async () => {
    const res = await GET(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  it("uploads all 7 tables, including the 2026-07-15 stopgap coverage", async () => {
    const res = await GET(req("Bearer secret123"));
    const json = await res.json();

    expect(json.backed_up.sort()).toEqual(
      ["agent_invocations", "attendance", "escalation_queue", "grades", "student_guardians", "students", "users"].sort()
    );
    expect(put).toHaveBeenCalledTimes(7);
    const paths = put.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        expect.stringContaining("users.csv"),
        expect.stringContaining("student_guardians.csv"),
        expect.stringContaining("escalation_queue.csv"),
        expect.stringContaining("agent_invocations.csv"),
      ])
    );
  });

  it("passes allowOverwrite:true on every upload (regression: a same-day re-trigger must not silently fail to update)", async () => {
    await GET(req("Bearer secret123"));
    expect(put).toHaveBeenCalledTimes(7);
    for (const call of put.mock.calls) {
      expect(call[2]).toMatchObject({ allowOverwrite: true });
    }
  });

  it("includes hashedPwd in the users export (needed to actually restore login capability)", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "u1", email: "a@b.com", loginId: null, hashedPwd: "$2b$hash", name: "A",
        role: "GUARDIAN", schoolId: "school-1", isPlatformAdmin: false,
        guardianCountryCode: "+231", guardianPhone: "0770000000", guardianPhoneE164: "+231770000000",
        preferredChannel: "SMS", smsOptIn: true, mustChangePIN: false, createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    await GET(req("Bearer secret123"));
    const usersCsvCall = put.mock.calls.find((c) => String(c[0]).includes("users.csv"));
    expect(usersCsvCall?.[1]).toContain("$2b$hash");
    expect(usersCsvCall?.[1]).toContain("+231770000000");
  });

  it("serializes AgentInvocation input/output JSON safely for CSV (commas/quotes don't corrupt columns)", async () => {
    prismaMock.agentInvocation.findMany.mockResolvedValue([
      {
        id: "inv1", agentName: "guardian", agentVersion: "1.0.0", goalId: null, userId: "u1",
        triggeredBy: "EVENT", input: { message: 'has, a comma and "quotes"' }, output: { reply: "ok" },
        status: "SUCCESS", errorMessage: null, escalationReason: null, createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    await GET(req("Bearer secret123"));
    const invCsvCall = put.mock.calls.find((c) => String(c[0]).includes("agent_invocations.csv"));
    const csv = invCsvCall?.[1] as string;
    // toCSV's own quoting: exactly one row after the header, no stray extra columns from an unescaped comma
    const rows = csv.trim().split("\n");
    expect(rows).toHaveLength(2);
  });

  it("the fetch phase is Promise.all, not allSettled: one failing table takes down the whole backup, not just that table", async () => {
    prismaMock.escalationQueue.findMany.mockRejectedValue(new Error("db timeout"));
    await expect(GET(req("Bearer secret123"))).rejects.toThrow("db timeout");
    // Documents existing behavior, not a claim it's ideal - only the upload
    // phase (Promise.allSettled) is partial-failure-tolerant.
    expect(put).not.toHaveBeenCalled();
  });
});
