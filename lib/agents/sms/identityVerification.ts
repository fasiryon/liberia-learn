/**
 * Guardian identity verification (Sprint 6.1, escalation point 1 - APPROVED
 * with the name-matching clarification below).
 * docs/agents/GUARDIAN_IDENTITY_VERIFICATION.md.
 *
 * Two paths:
 *  - Known number: guardianPhoneE164 on a GUARDIAN User matches the sender.
 *    Persistent identity (GuardianConversation.guardianId/verifiedAt).
 *  - Unknown number: Student-ID + full-name challenge, deterministic (not
 *    LLM-judged - a wrong tool-call-arg hallucination here would be a real
 *    access-control bug). Grants access to that one studentId for this
 *    conversation only (per-conversation, not a permanent identity binding -
 *    see GUARDIAN_IDENTITY_VERIFICATION.md option (a)).
 *
 * Name matching (the requested clarification): matchesGuardianChallengeName
 * (lib/agents/sms/nameMatch.ts) strips diacritics, is case/punctuation
 * insensitive, allows a single-token partial name ("Pewu" matches "Pewu
 * Gongloe" - the Student ID already narrows the search to one student), and
 * tolerates small edit-distance typos on tokens longer than 3 letters. This
 * is a general algorithm, not a hardcoded table of Liberian name variants -
 * no verified source for such a table exists in this repo.
 */
import { prisma } from "@/lib/db";
import { enqueueEscalation } from "@/lib/agents/escalation";
import { matchesGuardianChallengeName } from "@/lib/agents/sms/nameMatch";

const HOURLY_LIMIT = 2;
const DAILY_LIMIT = 5;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * A token shaped like a Student.humanReadableStudentId (Sprint 6.1 Finding 1):
 * 6-8 chars from the restricted alphabet (no O/0, no I/1), REQUIRED to
 * contain at least one digit. That last requirement is deliberate: an
 * ordinary English word is all-letters, so requiring a digit means this
 * regex essentially never false-positives on normal conversational text
 * ("Reply 1 for..." doesn't match either - "1" alone isn't 6-8 chars).
 * Case-insensitive; codes are generated uppercase but guardians may type
 * lowercase.
 */
const ID_CANDIDATE_RE = /\b(?=[A-HJ-NP-Z2-9]{6,8}\b)(?=[A-HJ-NP-Z2-9]*[2-9])[A-HJ-NP-Z2-9]{6,8}\b/i;

export interface ChallengeAttempt {
  studentIdCandidate: string;
  nameCandidate: string;
}

/** Extract a Student-ID-shaped token + the remaining text as the name, or
 * null if the message doesn't look like a challenge-response attempt at all. */
export function extractChallengeAttempt(text: string): ChallengeAttempt | null {
  const match = text.match(ID_CANDIDATE_RE);
  if (!match) return null;
  const studentIdCandidate = match[0].toUpperCase();
  const nameCandidate = (text.slice(0, match.index) + " " + text.slice(match.index! + match[0].length)).trim();
  if (!nameCandidate) return null;
  return { studentIdCandidate, nameCandidate };
}

export interface RateLimitState {
  attemptTimestamps: string[];
}

export function emptyRateLimitState(): RateLimitState {
  return { attemptTimestamps: [] };
}

export function checkRateLimit(
  state: RateLimitState,
  now: Date
): { blocked: boolean; reason?: "hourly" | "daily" } {
  const nowMs = now.getTime();
  const hourly = state.attemptTimestamps.filter((t) => nowMs - new Date(t).getTime() < HOUR_MS).length;
  const daily = state.attemptTimestamps.filter((t) => nowMs - new Date(t).getTime() < DAY_MS).length;
  if (daily >= DAILY_LIMIT) return { blocked: true, reason: "daily" };
  if (hourly >= HOURLY_LIMIT) return { blocked: true, reason: "hourly" };
  return { blocked: false };
}

export function recordAttempt(state: RateLimitState, now: Date): RateLimitState {
  const attemptTimestamps = [...state.attemptTimestamps, now.toISOString()].slice(-DAILY_LIMIT - HOURLY_LIMIT);
  return { attemptTimestamps };
}

/**
 * Known-number resolution: exactly one GUARDIAN User with this
 * guardianPhoneE164. If more than one User shares the number (a shared
 * household phone), deliberately do NOT auto-pick one - fall through to the
 * challenge flow instead. Disambiguating a shared phone between multiple
 * guardians is a follow-up (see GUARDIAN_MULTI_HOUSEHOLD.md), not built here.
 */
export async function resolveKnownGuardian(phoneE164: string): Promise<{ id: string } | null> {
  const matches = await prisma.user.findMany({
    where: { role: "GUARDIAN", guardianPhoneE164: phoneE164 },
    select: { id: true },
    take: 2,
  });
  if (matches.length !== 1) return null;
  return matches[0];
}

export interface ChallengeResult {
  outcome: "matched" | "no_such_student" | "name_mismatch" | "rate_limited";
  studentId?: string;
  studentFirstName?: string;
  rateLimitReason?: "hourly" | "daily";
}

/**
 * Attempt to resolve a Student-ID + name challenge. Records the attempt
 * (success or failure) in the returned rate-limit state; the caller persists
 * it. Logs a LOW-priority EscalationQueue entry for every failed/blocked
 * attempt for admin review, per the approved spec.
 */
export async function resolveChallenge(
  attempt: ChallengeAttempt,
  rateLimitState: RateLimitState,
  now: Date,
  ctx: { guardianPhone: string; traceId?: string | null }
): Promise<{ result: ChallengeResult; rateLimitState: RateLimitState }> {
  const preCheck = checkRateLimit(rateLimitState, now);
  if (preCheck.blocked) {
    await enqueueEscalation({
      agentName: "liberialearn-family",
      invocationId: null,
      reason: `identity-verification blocked (${preCheck.reason} rate limit): phone=${ctx.guardianPhone}`,
      priority: "LOW",
      traceId: ctx.traceId ?? null,
    });
    return { result: { outcome: "rate_limited", rateLimitReason: preCheck.reason }, rateLimitState };
  }

  const student = await prisma.student.findUnique({
    where: { humanReadableStudentId: attempt.studentIdCandidate },
    select: { id: true, user: { select: { name: true } } },
  });

  const updatedState = recordAttempt(rateLimitState, now);

  if (!student) {
    await logFailedAttempt(ctx, "no_such_student", attempt.studentIdCandidate);
    return { result: { outcome: "no_such_student" }, rateLimitState: updatedState };
  }

  const matches = matchesGuardianChallengeName(attempt.nameCandidate, student.user.name ?? "");
  if (!matches) {
    await logFailedAttempt(ctx, "name_mismatch", attempt.studentIdCandidate);
    return { result: { outcome: "name_mismatch" }, rateLimitState: updatedState };
  }

  return {
    result: {
      outcome: "matched",
      studentId: student.id,
      studentFirstName: student.user.name?.split(" ")[0] ?? "your child",
    },
    rateLimitState: updatedState,
  };
}

async function logFailedAttempt(
  ctx: { guardianPhone: string; traceId?: string | null },
  reason: "no_such_student" | "name_mismatch",
  studentIdCandidate: string
): Promise<void> {
  await enqueueEscalation({
    agentName: "liberialearn-family",
    invocationId: null,
    reason: `identity-verification failed (${reason}): phone=${ctx.guardianPhone} studentIdCandidate=${studentIdCandidate}`,
    priority: "LOW",
    traceId: ctx.traceId ?? null,
  });
}
