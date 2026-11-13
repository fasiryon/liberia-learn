export type ConflictPayload = {
  status: "conflict";
  opId?: string;
  entity: string;
  serverState: unknown;
  clientState: unknown;
  resolutionHint: string;
};

export type AttendanceClient = {
  meetingId: string;
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  clientUpdatedAt: string;
};

export type AttendanceServer = {
  meetingId: string;
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  markedAt: Date | string;
};

export function resolveAttendance(
  _server: AttendanceServer | null,
  _client: AttendanceClient
): { action: "apply"; status: AttendanceClient["status"]; markedAt: Date } | { action: "conflict"; hint: string } {
  // Device timestamps never grant canonical attendance write authority.
  // Keep this compatibility resolver fail-closed; a staff-reviewed workflow
  // must use its own authenticated attendance writer.
  return { action: "conflict", hint: "attendance_requires_teacher_review" };
}

export type SubmissionClient = {
  homeworkId: string;
  answers: unknown;
  clientUpdatedAt: string;
};

export type SubmissionServer = {
  homeworkId: string;
  submittedAt: Date | string | null;
  teacherScore: number | null;
  aiReviewed: boolean;
};

export function resolveSubmission(
  server: SubmissionServer | null,
  client: SubmissionClient
): { action: "apply"; submittedAt: Date; answers: unknown } | { action: "conflict"; hint: string } {
  // Policy: never overwrite graded submissions; require teacher/admin resolution.
  if (server && (server.teacherScore != null || server.aiReviewed)) {
    return { action: "conflict", hint: "submission_graded_server_wins" };
  }

  if (server?.submittedAt) {
    const serverTime = new Date(server.submittedAt).getTime();
    const clientTime = new Date(client.clientUpdatedAt).getTime();
    if (serverTime > clientTime) {
      return { action: "conflict", hint: "submission_last_write_wins_by_timestamp" };
    }
  }

  return { action: "apply", submittedAt: new Date(client.clientUpdatedAt), answers: client.answers };
}

