/**
 * Shared inbound-SMS handling for the LiberiaLearn Family agent (Sprint 6.1).
 * Both the real webhook (app/api/webhooks/sms-inbound) and the dev simulator
 * (app/api/dev/simulate-inbound-sms) funnel through here so behavior is
 * identical in dev and prod.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import { runAgent } from "@/lib/agents/runtime";
import { parseInboundSms, normalizeMsisdn } from "@/lib/agents/sms/inbound";
import { logger } from "@/lib/logger";

const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_MESSAGES = 10;

interface ConversationState {
  messages: { from: "guardian" | "agent"; text: string; at: string }[];
}

function emptyState(): ConversationState {
  return { messages: [] };
}

/**
 * Resolve a phone-bound conversation to a verified guardian identity.
 *
 * INTENTIONALLY INERT: identity verification (known-number match, Student
 * ID + name challenge, rate limiting) is Sprint 6.1 escalation point 1 and is
 * NOT implemented pending review of
 * docs/agents/GUARDIAN_IDENTITY_VERIFICATION.md. This always returns
 * unverified so the runtime's per-tool authorization (assertGuardianOf) has
 * nothing to grant access to yet — the agent can still greet/challenge a
 * caller via its system prompt, but no guardian.* tool call can succeed.
 */
function resolveGuardianIdentity(_conversation: { guardianId: string | null; verifiedAt: Date | null }): {
  guardianId: string | null;
} {
  return { guardianId: null };
}

export interface GuardianInboundResult {
  from: string;
  normalizedFrom: string;
  handled: boolean;
  agentStatus: string | null;
  response: string | null;
  invocationId: string | null;
}

export async function handleGuardianInbound(input: { from: string; text: string }): Promise<GuardianInboundResult> {
  const normalized = parseInboundSms(input);
  const now = new Date();
  const traceId = randomUUID();

  let conversation = await prisma.guardianConversation.findUnique({
    where: { guardianPhone: normalized.normalizedFrom },
  });

  const expired = conversation ? conversation.expiresAt.getTime() < now.getTime() : false;
  const state: ConversationState =
    !conversation || expired ? emptyState() : ((conversation.state as unknown as ConversationState) ?? emptyState());

  if (!conversation) {
    conversation = await prisma.guardianConversation.create({
      data: {
        guardianPhone: normalized.normalizedFrom,
        state: state as never,
        expiresAt: new Date(now.getTime() + CONVERSATION_TTL_MS),
      },
    });
  }

  const identity = resolveGuardianIdentity({ guardianId: conversation.guardianId, verifiedAt: conversation.verifiedAt });

  state.messages.push({ from: "guardian", text: normalized.text, at: normalized.receivedAt });

  const result = await runAgent("liberialearn-family", normalized.text, {
    userId: identity.guardianId,
    userRole: "system",
    traceId,
    triggeredBy: "USER",
  });

  if (result.response) {
    state.messages.push({ from: "agent", text: result.response, at: new Date().toISOString() });
  }
  state.messages = state.messages.slice(-MAX_STORED_MESSAGES);

  await prisma.guardianConversation.update({
    where: { id: conversation.id },
    data: { state: state as never, expiresAt: new Date(now.getTime() + CONVERSATION_TTL_MS) },
  });

  if (result.response) {
    const sendResult = await sendSMS(normalized.normalizedFrom, result.response);
    if (!sendResult.ok) {
      logger.warn("[guardian.inbound] SMS reply failed to send", {
        traceId,
        error: sendResult.error,
      });
    }
  }

  return {
    from: normalized.from,
    normalizedFrom: normalized.normalizedFrom,
    handled: true,
    agentStatus: result.status,
    response: result.response,
    invocationId: result.invocationId,
  };
}

export { normalizeMsisdn };
