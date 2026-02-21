import { describe, it, expect } from "vitest";
import { resolveAttendance, resolveSubmission } from "@/lib/offline-sync/policies";

describe("offline sync policies", () => {
  it("rejects stale attendance updates (server newer)", () => {
    const server = {
      meetingId: "m1",
      studentId: "s1",
      status: "PRESENT" as const,
      markedAt: new Date("2026-02-20T12:00:10.000Z"),
    };
    const client = {
      meetingId: "m1",
      studentId: "s1",
      status: "ABSENT" as const,
      clientUpdatedAt: "2026-02-20T12:00:00.000Z",
    };

    const result = resolveAttendance(server, client);
    expect(result).toEqual({ action: "conflict", hint: "attendance_last_write_wins_by_timestamp" });
  });

  it("never overwrites graded submissions", () => {
    const server = {
      homeworkId: "h1",
      submittedAt: new Date("2026-02-20T10:00:00.000Z"),
      teacherScore: 85,
      aiReviewed: false,
    };
    const client = {
      homeworkId: "h1",
      answers: { q1: "x" },
      clientUpdatedAt: "2026-02-20T12:00:00.000Z",
    };

    const result = resolveSubmission(server, client);
    expect(result).toEqual({ action: "conflict", hint: "submission_graded_server_wins" });
  });
});


