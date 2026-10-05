/**
 * Observable participation signals.
 *
 * Every signal is a count, duration or timestamp the platform actually
 * recorded. The module deliberately has no vocabulary for psychological
 * inference (motivation, frustration, learning style, effort, attitude): a
 * signal says what happened, a teacher decides what it means. Signals never
 * change mastery, calibration or the official grade.
 */
export const PARTICIPATION_SIGNAL_POLICY_VERSION = "participation-signal-policy/1.0.0" as const;

export type ParticipationObservation =
  | Readonly<{ kind: "ATTENDANCE"; id: string; date: string; present: boolean }>
  | Readonly<{ kind: "SESSION"; id: string; startedAt: string; endedAt: string | null; completed: boolean }>
  | Readonly<{ kind: "ASSIGNMENT"; id: string; dueAt: string; submittedAt: string | null }>
  | Readonly<{ kind: "RESPONSE"; id: string; at: string; conceptId: string; responseMs: number; correct: boolean; attempt: number }>
  | Readonly<{ kind: "HELP_REQUEST"; id: string; at: string; conceptId: string | null }>;

export type ParticipationSignalCode =
  | "ATTENDANCE_RATE" | "INACTIVITY" | "ASSIGNMENT_COMPLETION" | "ABANDONED_SESSIONS"
  | "REPEATED_RAPID_RESPONSES" | "HELP_REQUESTS" | "RETRIES" | "TIME_SINCE_LAST_EVIDENCE";

export type ParticipationSignal = Readonly<{
  code: ParticipationSignalCode;
  value: number | null;
  unit: "RATIO" | "DAYS" | "COUNT";
  flagged: boolean;
  threshold: number | null;
  observationIds: readonly string[];
  description: string;
}>;

export const PARTICIPATION_SIGNAL_POLICY_V1 = Object.freeze({
  version: PARTICIPATION_SIGNAL_POLICY_VERSION,
  status: "STARTING_HYPOTHESIS_REQUIRES_EDUCATIONAL_REVIEW" as const,
  windowDays: 28,
  inactivityDays: 7,
  minAttendanceRate: 0.8,
  minAssignmentCompletion: 0.7,
  abandonedSessionsFlag: 3,
  /** A response faster than this and incorrect is recorded as "rapid"; no intent is inferred. */
  rapidResponseMs: 3_000,
  rapidResponsesFlag: 3,
  retriesFlag: 5,
  helpRequestsFlag: 5,
  evidenceGapDays: 14,
});

export type ParticipationSignalPolicy = typeof PARTICIPATION_SIGNAL_POLICY_V1;

export type ParticipationSnapshot = Readonly<{
  policyVersion: typeof PARTICIPATION_SIGNAL_POLICY_VERSION;
  asOf: string;
  windowStart: string;
  signals: readonly ParticipationSignal[];
  authority: Readonly<{ observableOnly: true; infersPsychologicalState: false; mayChangeMastery: false }>;
}>;

const DAY_MS = 86_400_000;

function ms(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label}_timestamp_invalid`);
  return parsed;
}

function observedAt(observation: ParticipationObservation): number {
  switch (observation.kind) {
    case "ATTENDANCE": return ms(observation.date, "attendance");
    case "SESSION": return ms(observation.startedAt, "session");
    case "ASSIGNMENT": return ms(observation.dueAt, "assignment");
    default: return ms(observation.at, "observation");
  }
}

function days(value: number): number {
  return Math.round((value / DAY_MS) * 100) / 100;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 10_000) / 10_000;
}

export function deriveParticipationSignals(input: {
  observations: readonly ParticipationObservation[];
  lastGovernedEvidenceAt: string | null;
  asOf: string;
  policy?: ParticipationSignalPolicy;
}): ParticipationSnapshot {
  const policy = input.policy ?? PARTICIPATION_SIGNAL_POLICY_V1;
  if (policy.version !== PARTICIPATION_SIGNAL_POLICY_VERSION) throw new Error("participation_policy_version_unsupported");
  const asOf = ms(input.asOf, "participation_as_of");
  const windowStart = asOf - policy.windowDays * DAY_MS;
  const seen = new Set<string>();
  const inWindow: ParticipationObservation[] = [];
  for (const observation of input.observations) {
    // Offline replays may resend an observation; identity makes counting idempotent.
    const key = `${observation.kind}:${observation.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const at = observedAt(observation);
    if (at <= asOf && at >= windowStart) inWindow.push(observation);
  }
  const ofKind = <K extends ParticipationObservation["kind"]>(kind: K) =>
    inWindow.filter((entry): entry is Extract<ParticipationObservation, { kind: K }> => entry.kind === kind);
  const ids = (entries: readonly { id: string }[]) => Object.freeze(entries.map((entry) => entry.id).sort());

  const attendance = ofKind("ATTENDANCE");
  const present = attendance.filter((entry) => entry.present);
  const attendanceRate = ratio(present.length, attendance.length);

  // Governed evidence is platform activity too. Missing data is reported as null, never as inactivity.
  const activityTimes = inWindow.filter((entry) => entry.kind !== "ASSIGNMENT" && entry.kind !== "ATTENDANCE")
    .map(observedAt)
    .concat(input.lastGovernedEvidenceAt === null ? [] : [ms(input.lastGovernedEvidenceAt, "last_evidence")])
    .filter((value) => value <= asOf);
  const lastActivity = activityTimes.length ? Math.max(...activityTimes) : null;
  const inactiveDays = lastActivity === null ? null : days(asOf - lastActivity);

  const dueAssignments = ofKind("ASSIGNMENT").filter((entry) => ms(entry.dueAt, "assignment") <= asOf);
  const submitted = dueAssignments.filter((entry) => entry.submittedAt !== null && ms(entry.submittedAt, "submission") <= asOf);
  const completion = ratio(submitted.length, dueAssignments.length);

  const abandoned = ofKind("SESSION").filter((entry) => !entry.completed);
  const responses = ofKind("RESPONSE");
  const rapid = responses.filter((entry) => entry.responseMs < policy.rapidResponseMs && !entry.correct);
  const retries = responses.filter((entry) => entry.attempt > 1);
  const help = ofKind("HELP_REQUEST");
  const evidenceGap = input.lastGovernedEvidenceAt === null ? null : days(asOf - ms(input.lastGovernedEvidenceAt, "last_evidence"));

  const signals: ParticipationSignal[] = [
    { code: "ATTENDANCE_RATE", value: attendanceRate, unit: "RATIO", threshold: policy.minAttendanceRate,
      flagged: attendanceRate !== null && attendanceRate < policy.minAttendanceRate, observationIds: ids(attendance.filter((entry) => !entry.present)),
      description: `Present on ${present.length} of ${attendance.length} recorded school days in the window.` },
    { code: "INACTIVITY", value: inactiveDays, unit: "DAYS", threshold: policy.inactivityDays,
      flagged: inactiveDays !== null && inactiveDays >= policy.inactivityDays, observationIds: Object.freeze([]),
      description: inactiveDays === null ? "No activity or governed evidence has been recorded for this learner." : `Last platform activity or governed evidence ${inactiveDays} days ago.` },
    { code: "ASSIGNMENT_COMPLETION", value: completion, unit: "RATIO", threshold: policy.minAssignmentCompletion,
      flagged: completion !== null && completion < policy.minAssignmentCompletion,
      observationIds: ids(dueAssignments.filter((entry) => !submitted.includes(entry))),
      description: `Submitted ${submitted.length} of ${dueAssignments.length} assignments that were due.` },
    { code: "ABANDONED_SESSIONS", value: abandoned.length, unit: "COUNT", threshold: policy.abandonedSessionsFlag,
      flagged: abandoned.length >= policy.abandonedSessionsFlag, observationIds: ids(abandoned),
      description: `${abandoned.length} learning sessions ended without completion.` },
    { code: "REPEATED_RAPID_RESPONSES", value: rapid.length, unit: "COUNT", threshold: policy.rapidResponsesFlag,
      flagged: rapid.length >= policy.rapidResponsesFlag, observationIds: ids(rapid),
      description: `${rapid.length} incorrect responses were submitted in under ${policy.rapidResponseMs / 1000} seconds.` },
    { code: "HELP_REQUESTS", value: help.length, unit: "COUNT", threshold: policy.helpRequestsFlag,
      flagged: help.length >= policy.helpRequestsFlag, observationIds: ids(help),
      description: `${help.length} help requests recorded.` },
    { code: "RETRIES", value: retries.length, unit: "COUNT", threshold: policy.retriesFlag,
      flagged: retries.length >= policy.retriesFlag, observationIds: ids(retries),
      description: `${retries.length} responses were second or later attempts.` },
    { code: "TIME_SINCE_LAST_EVIDENCE", value: evidenceGap, unit: "DAYS", threshold: policy.evidenceGapDays,
      flagged: evidenceGap !== null && evidenceGap >= policy.evidenceGapDays, observationIds: Object.freeze([]),
      description: evidenceGap === null ? "No governed learning evidence recorded yet." : `Latest governed evidence was ${evidenceGap} days ago.` },
  ];
  return Object.freeze({
    policyVersion: PARTICIPATION_SIGNAL_POLICY_VERSION,
    asOf: input.asOf,
    windowStart: new Date(windowStart).toISOString(),
    signals: Object.freeze(signals.map((signal) => Object.freeze(signal))),
    authority: Object.freeze({ observableOnly: true as const, infersPsychologicalState: false as const, mayChangeMastery: false as const }),
  });
}
