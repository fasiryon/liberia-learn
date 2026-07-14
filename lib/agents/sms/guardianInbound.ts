/**
 * Shared inbound-SMS handling for the LiberiaLearn Family agent (Sprint 6.1).
 * Both the real webhook (app/api/webhooks/sms-inbound) and the dev simulator
 * (app/api/dev/simulate-inbound-sms) funnel through here so behavior is
 * identical in dev and prod.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { sendTwoWaySMS } from "@/lib/sms";
import { runAgent } from "@/lib/agents/runtime";
import { parseInboundSms, normalizeMsisdn } from "@/lib/agents/sms/inbound";
import {
  extractChallengeAttempt,
  resolveChallenge,
  resolveKnownGuardian,
  emptyRateLimitState,
  type RateLimitState,
} from "@/lib/agents/sms/identityVerification";
import { checkSmsCostCap, countSmsSegments, recordSmsSpend } from "@/lib/agents/sms/smsCost";
import { detectSafeguardingKeywords } from "@/lib/agents/safeguarding/keywordGate";
import { notifySchoolSafeguarding } from "@/lib/agents/safeguarding/notify";
import { SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE } from "@/lib/agents/safeguarding/resources";
import { enqueueEscalation } from "@/lib/agents/escalation";
import { logger } from "@/lib/logger";

const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_MESSAGES = 10;

interface ConversationState {
  messages: { from: "guardian" | "agent"; text: string; at: string }[];
  grantedStudentIds?: string[];
  verification?: RateLimitState;
}

function emptyState(): ConversationState {
  return { messages: [], grantedStudentIds: [], verification: emptyRateLimitState() };
}

export interface GuardianInboundResult {
  from: string;
  normalizedFrom: string;
  handled: boolean;
  agentStatus: string | null;
  response: string | null;
  invocationId: string | null;
}

const RATE_LIMIT_MESSAGES: Record<"hourly" | "daily", string> = {
  hourly: "Too many attempts. Please try again in a bit.",
  daily: "Too many attempts today. Please try again tomorrow, or contact the school directly.",
};

const CHALLENGE_FAILED_MESSAGE =
  "I couldn't verify that. Please reply with your child's Student ID and full name exactly as given by the school.";

async function sendReply(phone: string, body: string, traceId: string): Promise<void> {
  // sendTwoWaySMS, not sendSMS: this is the outbound leg of a two-way
  // conversation, and Orange doesn't support the inbound leg yet - see
  // lib/sms.ts:selectTwoWaySmsProvider.
  const sendResult = await sendTwoWaySMS(phone, body);
  if (!sendResult.ok) {
    logger.warn("[guardian.inbound] SMS reply failed to send", { traceId, error: sendResult.error });
  }
}

/**
 * Resolve a schoolId to notify for a safeguarding escalation, from whatever
 * identity is available (may be neither, if the caller is fully
 * unverified - that case is logged but not notified, since there is no
 * school to target).
 */
async function resolveSchoolIdForSafeguarding(
  userId: string | null,
  grantedStudentIds: string[] | null
): Promise<string | null> {
  if (userId) {
    const guardian = await prisma.user.findUnique({
      where: { id: userId },
      select: { guardianOf: { take: 1, select: { student: { select: { user: { select: { schoolId: true } } } } } } },
    });
    const schoolId = guardian?.guardianOf[0]?.student.user.schoolId;
    if (schoolId) return schoolId;
  }
  if (grantedStudentIds?.length) {
    const student = await prisma.student.findUnique({
      where: { id: grantedStudentIds[grantedStudentIds.length - 1] },
      select: { user: { select: { schoolId: true } } },
    });
    if (student?.user.schoolId) return student.user.schoolId;
  }
  return null;
}

export async function handleGuardianInbound(input: { from: string; text: string }): Promise<GuardianInboundResult> {
  const normalized = parseInboundSms(input);
  const now = new Date();
  const traceId = randomUUID();
  const phone = normalized.normalizedFrom;

  let conversation = await prisma.guardianConversation.findUnique({ where: { guardianPhone: phone } });
  const expired = conversation ? conversation.expiresAt.getTime() < now.getTime() : false;
  const state: ConversationState =
    !conversation || expired
      ? emptyState()
      : {
          ...emptyState(),
          ...((conversation.state as unknown as ConversationState) ?? {}),
        };

  if (!conversation) {
    conversation = await prisma.guardianConversation.create({
      data: { guardianPhone: phone, state: state as never, expiresAt: new Date(now.getTime() + CONVERSATION_TTL_MS) },
    });
  }

  // --- Identity resolution ---
  let userId: string | null = conversation.guardianId;
  let newlyKnownGuardian = false;
  let contextLine = "[context: unverified]";
  let grantedFirstName: string | null = null;

  if (!userId) {
    const known = await resolveKnownGuardian(phone);
    if (known) {
      userId = known.id;
      newlyKnownGuardian = true;
    }
  }

  if (userId) {
    // Known-number guardians aren't scoped to one studentId the way a
    // challenge grant is - resolve every linked student so the agent has a
    // real studentId to pass to guardian.* tools, instead of hallucinating
    // one (observed in Deliverable 10 E2E testing: without this, the LLM
    // invented a literal "<id>" placeholder and every tool call failed).
    const linkedStudents = await prisma.studentGuardian.findMany({
      where: { guardianId: userId },
      select: { student: { select: { id: true, user: { select: { name: true } } } } },
    });
    const studentList = linkedStudents
      .map((sg) => `{studentId=${sg.student.id} name=${sg.student.user.name?.split(" ")[0] ?? "unknown"}}`)
      .join(", ");
    contextLine = studentList ? `[context: verified students=[${studentList}]]` : "[context: verified]";
  } else if (state.grantedStudentIds?.length) {
    // Already granted earlier in this conversation - reuse without re-challenging.
    contextLine = `[context: verified studentId=${state.grantedStudentIds[state.grantedStudentIds.length - 1]}]`;
  } else {
    const attempt = extractChallengeAttempt(normalized.text);
    if (attempt) {
      const { result, rateLimitState } = await resolveChallenge(
        attempt,
        state.verification ?? emptyRateLimitState(),
        now,
        { guardianPhone: phone, traceId }
      );
      state.verification = rateLimitState;

      if (result.outcome === "rate_limited") {
        await persistConversation(conversation.id, state, now, { userId: null, verifiedAt: null });
        await sendCappedReply(phone, RATE_LIMIT_MESSAGES[result.rateLimitReason!], traceId, false);
        return {
          from: normalized.from,
          normalizedFrom: phone,
          handled: true,
          agentStatus: "RATE_LIMITED",
          response: RATE_LIMIT_MESSAGES[result.rateLimitReason!],
          invocationId: null,
        };
      }

      if (result.outcome === "no_such_student" || result.outcome === "name_mismatch") {
        await persistConversation(conversation.id, state, now, { userId: null, verifiedAt: null });
        await sendCappedReply(phone, CHALLENGE_FAILED_MESSAGE, traceId, false);
        return {
          from: normalized.from,
          normalizedFrom: phone,
          handled: true,
          agentStatus: "VERIFICATION_FAILED",
          response: CHALLENGE_FAILED_MESSAGE,
          invocationId: null,
        };
      }

      // matched
      state.grantedStudentIds = [...(state.grantedStudentIds ?? []), result.studentId!];
      grantedFirstName = result.studentFirstName ?? null;
      contextLine = `[context: verified studentId=${result.studentId} name=${grantedFirstName}]`;
    }
  }

  state.messages.push({ from: "guardian", text: normalized.text, at: normalized.receivedAt });
  state.messages = state.messages.slice(-MAX_STORED_MESSAGES);

  // --- Safeguarding keyword gate (Sprint 6.1 Spec 5, Gate C - a deterministic
  // floor under the agent's own judgment; "false positives acceptable, false
  // negatives are not"). Bypasses the LLM entirely for this message so the
  // acknowledgment text and resources are guaranteed correct, not
  // LLM-composed under a 300-token cap. ---
  if (detectSafeguardingKeywords(normalized.text)) {
    await persistConversation(conversation.id, state, now, {
      userId: newlyKnownGuardian ? userId : conversation.guardianId,
      verifiedAt: newlyKnownGuardian ? now : conversation.verifiedAt,
    });

    const schoolId = await resolveSchoolIdForSafeguarding(userId, state.grantedStudentIds ?? null);
    const { id: escalationId } = await enqueueEscalation({
      agentName: "liberialearn-family",
      invocationId: null,
      userId: userId ?? null,
      reason: "safeguarding (keyword gate): possible concern in guardian message",
      priority: "HIGH",
      traceId,
      schoolId,
    });

    if (schoolId) {
      await notifySchoolSafeguarding(schoolId, `Guardian message flagged for safeguarding review (escalation ${escalationId}).`);
    } else {
      logger.warn("[guardian.inbound] safeguarding escalation has no resolvable schoolId - school not notified", {
        traceId,
        escalationId,
      });
    }

    // Never rate/cost-limited (approved Spec 4 exception), but spend is still
    // recorded for reporting accuracy.
    await sendReply(phone, SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE, traceId);
    await recordSmsSpend(phone, countSmsSegments(SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE));

    return {
      from: normalized.from,
      normalizedFrom: phone,
      handled: true,
      agentStatus: "SAFEGUARDING_ESCALATED",
      response: SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE,
      invocationId: null,
    };
  }

  const agentInput = `${contextLine}\n${normalized.text}`;
  const result = await runAgent("liberialearn-family", agentInput, {
    userId,
    userRole: "system",
    traceId,
    triggeredBy: "USER",
    grantedStudentIds: state.grantedStudentIds ?? null,
  });

  if (result.response) {
    state.messages.push({ from: "agent", text: result.response, at: new Date().toISOString() });
  }
  state.messages = state.messages.slice(-MAX_STORED_MESSAGES);

  await persistConversation(conversation.id, state, now, {
    userId: newlyKnownGuardian ? userId : conversation.guardianId,
    verifiedAt: newlyKnownGuardian ? now : conversation.verifiedAt,
  });

  if (result.response) {
    const isSafeguarding = result.toolCalls.some((tc) => tc.tool === "safeguarding.escalate" && tc.ok);
    await sendCappedReply(phone, result.response, traceId, isSafeguarding);
  }

  return {
    from: normalized.from,
    normalizedFrom: phone,
    handled: true,
    agentStatus: result.status,
    response: result.response,
    invocationId: result.invocationId,
  };
}

async function persistConversation(
  id: string,
  state: ConversationState,
  now: Date,
  identity: { userId: string | null; verifiedAt: Date | null }
): Promise<void> {
  await prisma.guardianConversation.update({
    where: { id },
    data: {
      state: state as never,
      expiresAt: new Date(now.getTime() + CONVERSATION_TTL_MS),
      guardianId: identity.userId,
      verifiedAt: identity.verifiedAt,
    },
  });
}

/**
 * Sends an SMS reply subject to the per-guardian/total daily segment cap
 * (GUARDIAN_COST_ACCOUNTING.md, approved). `bypassCap: true` for
 * safeguarding escalations - approved Spec 4 exception: a guardian at their
 * daily cap can still trigger and receive a safeguarding acknowledgment.
 */
async function sendCappedReply(phone: string, body: string, traceId: string, bypassCap: boolean): Promise<void> {
  const segments = countSmsSegments(body);
  if (!bypassCap) {
    const cap = await checkSmsCostCap(phone, segments);
    if (!cap.allowed) {
      logger.warn("[guardian.inbound] SMS reply suppressed by cost cap", { traceId, phone, reason: cap.reason });
      return;
    }
  }
  await sendReply(phone, body, traceId);
  await recordSmsSpend(phone, segments);
}

export { normalizeMsisdn };
