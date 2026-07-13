import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockEnqueueEscalation } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findMany: vi.fn() },
    student: { findUnique: vi.fn() },
  },
  mockEnqueueEscalation: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));

import {
  extractChallengeAttempt,
  checkRateLimit,
  recordAttempt,
  emptyRateLimitState,
  resolveKnownGuardian,
  resolveChallenge,
} from "@/lib/agents/sms/identityVerification";

const FAKE_ID = "ckx7h2j9k0000qzrmn831p4a"; // cuid-shaped

describe("extractChallengeAttempt", () => {
  it("extracts a cuid-shaped token and treats the rest as the name", () => {
    const result = extractChallengeAttempt(`${FAKE_ID} Pewu Gongloe`);
    expect(result).toEqual({ studentIdCandidate: FAKE_ID, nameCandidate: "Pewu Gongloe" });
  });

  it("works with the ID in the middle of the message", () => {
    const result = extractChallengeAttempt(`My child's id is ${FAKE_ID} and name is Pewu`);
    expect(result?.studentIdCandidate).toBe(FAKE_ID);
    expect(result?.nameCandidate).toContain("Pewu");
  });

  it("returns null for an ordinary question with no ID-shaped token", () => {
    expect(extractChallengeAttempt("How is my son doing in math?")).toBeNull();
  });

  it("returns null when an ID is found but no name remains", () => {
    expect(extractChallengeAttempt(FAKE_ID)).toBeNull();
  });

  it("is case-insensitive on the ID token", () => {
    const result = extractChallengeAttempt(`${FAKE_ID.toUpperCase()} Pewu Gongloe`);
    expect(result?.studentIdCandidate).toBe(FAKE_ID);
  });
});

describe("rate limiting", () => {
  it("starts with an empty attempt log and allows attempts", () => {
    const state = emptyRateLimitState();
    expect(checkRateLimit(state, new Date())).toEqual({ blocked: false });
  });

  it("blocks after 2 attempts within the last hour", () => {
    const now = new Date("2026-07-13T12:00:00Z");
    let state = emptyRateLimitState();
    state = recordAttempt(state, new Date("2026-07-13T11:50:00Z"));
    state = recordAttempt(state, new Date("2026-07-13T11:55:00Z"));
    expect(checkRateLimit(state, now)).toEqual({ blocked: true, reason: "hourly" });
  });

  it("does not count attempts older than an hour toward the hourly limit", () => {
    const now = new Date("2026-07-13T12:00:00Z");
    let state = emptyRateLimitState();
    state = recordAttempt(state, new Date("2026-07-13T10:00:00Z"));
    state = recordAttempt(state, new Date("2026-07-13T10:05:00Z"));
    expect(checkRateLimit(state, now)).toEqual({ blocked: false });
  });

  it("blocks after 5 attempts within the last day even if hourly-spaced", () => {
    const now = new Date("2026-07-13T23:00:00Z");
    let state = emptyRateLimitState();
    for (const h of [1, 5, 9, 13, 17]) {
      state = recordAttempt(state, new Date(`2026-07-13T${String(h).padStart(2, "0")}:00:00Z`));
    }
    expect(checkRateLimit(state, now)).toEqual({ blocked: true, reason: "daily" });
  });
});

describe("resolveKnownGuardian", () => {
  beforeEach(() => mockPrisma.user.findMany.mockReset());

  it("resolves when exactly one guardian matches the phone number", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "guardian-1" }]);
    const result = await resolveKnownGuardian("+231770000111");
    expect(result).toEqual({ id: "guardian-1" });
  });

  it("returns null when no guardian matches", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    expect(await resolveKnownGuardian("+231770000111")).toBeNull();
  });

  it("returns null (does not guess) when multiple guardians share the phone", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "guardian-1" }, { id: "guardian-2" }]);
    expect(await resolveKnownGuardian("+231770000111")).toBeNull();
  });
});

describe("resolveChallenge", () => {
  beforeEach(() => {
    mockPrisma.student.findUnique.mockReset();
    mockEnqueueEscalation.mockReset();
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });
  });

  const ctx = { guardianPhone: "+231770000111", traceId: "trace-1" };

  it("matches and returns the studentId + first name", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({ id: "student-1", user: { name: "Pewu Gongloe" } });
    const { result } = await resolveChallenge(
      { studentIdCandidate: "student-1", nameCandidate: "Pewu" },
      emptyRateLimitState(),
      new Date(),
      ctx
    );
    expect(result).toEqual({ outcome: "matched", studentId: "student-1", studentFirstName: "Pewu" });
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("fails with no_such_student and logs a LOW escalation", async () => {
    mockPrisma.student.findUnique.mockResolvedValue(null);
    const { result } = await resolveChallenge(
      { studentIdCandidate: "ghost", nameCandidate: "Pewu" },
      emptyRateLimitState(),
      new Date(),
      ctx
    );
    expect(result.outcome).toBe("no_such_student");
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(expect.objectContaining({ priority: "LOW" }));
  });

  it("fails with name_mismatch and logs a LOW escalation", async () => {
    mockPrisma.student.findUnique.mockResolvedValue({ id: "student-1", user: { name: "Pewu Gongloe" } });
    const { result } = await resolveChallenge(
      { studentIdCandidate: "student-1", nameCandidate: "Wrong Name" },
      emptyRateLimitState(),
      new Date(),
      ctx
    );
    expect(result.outcome).toBe("name_mismatch");
    expect(mockEnqueueEscalation).toHaveBeenCalled();
  });

  it("short-circuits to rate_limited without querying the DB when already blocked", async () => {
    const now = new Date("2026-07-13T12:00:00Z");
    let state = emptyRateLimitState();
    state = recordAttempt(state, new Date("2026-07-13T11:50:00Z"));
    state = recordAttempt(state, new Date("2026-07-13T11:55:00Z"));

    const { result } = await resolveChallenge({ studentIdCandidate: "student-1", nameCandidate: "Pewu" }, state, now, ctx);
    expect(result.outcome).toBe("rate_limited");
    expect(result.rateLimitReason).toBe("hourly");
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(expect.objectContaining({ priority: "LOW" }));
  });
});
