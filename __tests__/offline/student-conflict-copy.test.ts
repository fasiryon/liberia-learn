// SEC-R02 / AT-LAB-STUDENT-SCORE: a conflict the server keeps is explained to the student and never retried.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { studentConflictMessage } from "@/lib/offline/conflictCopy";
import { normalizeReasonCode } from "@/lib/offline/syncDiagnosticsContract";

describe("student wording for kept conflicts", () => {
  it("attendance says the teacher records it and the note will not be sent again", () => {
    expect(studentConflictMessage("attendance_requires_teacher_review")).toBe("Your teacher records attendance. Your device kept this note, and it will not be sent again.");
  });
  it("a reviewed lab uses the same words as the online 409", () => {
    expect(studentConflictMessage("completed_lab_session_requires_review")).toBe("This lab is already submitted. Your teacher reviews it now.");
  });
  it("unknown or missing hints get wording that promises no automatic resend", () => {
    for (const hint of [undefined, null, "", "server_conflict", "something_new"]) expect(studentConflictMessage(hint)).toMatch(/will not be sent again by itself/);
  });
  it("the SEC-R02 hint is a known diagnostics code, not 'other'", () => {
    expect(normalizeReasonCode("attendance_requires_teacher_review")).toBe("attendance_requires_teacher_review");
  });
  it("the offline status page lists conflicts apart from waiting items, with this wording", () => {
    const page = fs.readFileSync("app/student/offline-status/page.tsx", "utf8");
    expect(page).toContain("studentConflictMessage(item.conflict?.resolutionHint)");
    expect(page).toMatch(/waiting = items\.filter\(\(item\) => item\.status !== "conflict"\)/);
  });
});
