/**
 * Inbound SMS normalization for the agent platform. The real Africa's Talking
 * webhook and the dev simulator both funnel through here so parsing behaves
 * identically. No SMS-facing agent is wired yet (that arrives in 6.1+).
 */

export interface InboundSms {
  from: string;
  text: string;
}

export interface NormalizedInbound {
  from: string;
  normalizedFrom: string;
  text: string;
  receivedAt: string;
}

/** Normalize a phone number to a compact E.164-ish string with a leading +. */
export function normalizeMsisdn(raw: string): string {
  const stripped = raw.replace(/[^\d+]/g, "");
  const digits = stripped.replace(/\+/g, "");
  return `+${digits}`;
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

export function parseInboundSms(input: InboundSms): NormalizedInbound {
  const from = (input.from ?? "").trim();
  const text = (input.text ?? "").trim();
  if (!from) throw badRequest("'from' is required");
  if (!text) throw badRequest("'text' is required");
  return {
    from,
    normalizedFrom: normalizeMsisdn(from),
    text,
    receivedAt: new Date().toISOString(),
  };
}
