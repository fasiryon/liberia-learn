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
  server: AttendanceServer | null,
  client: AttendanceClient
): { action: "apply"; status: AttendanceClient["status"]; markedAt: Date } | { action: "conflict"; hint: string } {
  // Policy: last-write-wins by timestamp (clientUpdatedAt vs server markedAt).
  if (server?.markedAt) {
    const serverTime = new Date(server.markedAt).getTime();
    const clientTime = new Date(client.clientUpdatedAt).getTime();
    if (serverTime > clientTime) {
      return { action: "conflict", hint: "attendance_last_write_wins_by_timestamp" };
    }
  }
  return { action: "apply", status: client.status, markedAt: new Date(client.clientUpdatedAt) };
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


