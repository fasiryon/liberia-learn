/**
 * Per-guardian SMS delivery cost accounting (Sprint 6.1, escalation point 4 -
 * APPROVED with the rate-citation and safeguarding-exception clarifications
 * below). docs/agents/GUARDIAN_COST_ACCOUNTING.md.
 *
 * PROVIDER-AWARE RATE (updated for the Orange Liberia integration): the rate
 * used for cap math now follows lib/sms.ts's SMS_PROVIDER selection, since
 * Twilio and Orange are priced roughly 4-5x apart. Africa's Talking does not
 * support Liberia at all (confirmed against their published country-coverage
 * list, 2026-07-13 - no Liberia SMS product exists to price), so it is never
 * the active-rate branch even if selected.
 */
import { prisma } from "@/lib/db";

/** USD per SMS segment, Twilio published rate for Liberia (+231), both
 * outbound and inbound. Source: https://www.twilio.com/en-us/sms/pricing/lr
 * (checked 2026-07-13). */
const TWILIO_RATE_USD_PER_SEGMENT = Number(process.env.GUARDIAN_SMS_TWILIO_RATE_USD_PER_SEGMENT ?? 0.2677);

/** USD per SMS segment, Orange Liberia's own published starting price
 * ("Bundles from 100 to 50,000 SMS: starting at 0.06$ per message", billed
 * against prepaid airtime). Source: https://developer.orange.com/apis/sms-liberia
 * (checked 2026-07-14). Larger bundles are cheaper per message; this is the
 * conservative (highest) starting-tier price. */
const ORANGE_RATE_USD_PER_SEGMENT = Number(process.env.GUARDIAN_SMS_ORANGE_RATE_USD_PER_SEGMENT ?? 0.06);

/** The per-segment rate for whichever provider lib/sms.ts would actually
 * select right now (mirrors its SMS_PROVIDER selection logic). Defaults to
 * the Twilio rate, matching lib/sms.ts's own default when no provider is
 * explicitly selected. */
export function getActiveSmsRateUsdPerSegment(): number {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (explicit === "orange") return ORANGE_RATE_USD_PER_SEGMENT;
  return TWILIO_RATE_USD_PER_SEGMENT;
}

/** Per-guardian daily segment cap. Default 10 segments/day - conservative
 * pilot starting point (a normal conversation of a few short replies stays
 * well under this; it mainly caps runaway/abusive usage). */
const PER_GUARDIAN_DAILY_SEGMENT_CAP = Number(process.env.GUARDIAN_SMS_DAILY_SEGMENT_CAP ?? 10);

/** Total daily segment cap across all guardians. Default 180 segments/day,
 * chosen to roughly match the existing $50/day LLM cost-cap order of
 * magnitude at the Twilio rate above (50 / 0.2677 ~= 187, rounded down). */
const TOTAL_DAILY_SEGMENT_CAP = Number(process.env.GUARDIAN_SMS_TOTAL_DAILY_SEGMENT_CAP ?? 180);

const GSM7_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);

function isGsm7(text: string): boolean {
  return [...text].every((ch) => GSM7_BASIC.has(ch));
}

/** Approximate SMS segment count using standard GSM-7 (160/153 chars) or
 * UCS-2 (70/67 chars) concatenation rules. */
export function countSmsSegments(text: string): number {
  if (!text) return 0;
  const gsm7 = isGsm7(text);
  const singleLimit = gsm7 ? 160 : 70;
  const multiLimit = gsm7 ? 153 : 67;
  if (text.length <= singleLimit) return 1;
  return Math.ceil(text.length / multiLimit);
}

function dayKeyUTC(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export interface SmsCapResult {
  allowed: boolean;
  reason?: "guardian_daily_cap" | "total_daily_cap";
}

/** Pre-send cap check. `bypassCap: true` (safeguarding escalations - see
 * GUARDIAN_SAFEGUARDING.md and the approved Spec 4 exception) always
 * allows the send but still records the spend for reporting accuracy. */
export async function checkSmsCostCap(
  guardianPhone: string,
  segments: number,
  at: Date = new Date()
): Promise<SmsCapResult> {
  const date = dayKeyUTC(at);

  const totalRow = await prisma.guardianSmsCostAccounting.aggregate({
    _sum: { outboundSegments: true },
    where: { date },
  });
  const totalToday = totalRow._sum.outboundSegments ?? 0;
  if (totalToday + segments > TOTAL_DAILY_SEGMENT_CAP) {
    return { allowed: false, reason: "total_daily_cap" };
  }

  const guardianRow = await prisma.guardianSmsCostAccounting.findUnique({
    where: { guardianPhone_date: { guardianPhone, date } },
    select: { outboundSegments: true },
  });
  const guardianToday = guardianRow?.outboundSegments ?? 0;
  if (guardianToday + segments > PER_GUARDIAN_DAILY_SEGMENT_CAP) {
    return { allowed: false, reason: "guardian_daily_cap" };
  }

  return { allowed: true };
}

/** Record actual spend after a send (or a suppressed send, for reporting). */
export async function recordSmsSpend(guardianPhone: string, segments: number, at: Date = new Date()): Promise<void> {
  const date = dayKeyUTC(at);
  const costUSD = segments * getActiveSmsRateUsdPerSegment();
  await prisma.guardianSmsCostAccounting.upsert({
    where: { guardianPhone_date: { guardianPhone, date } },
    create: {
      guardianPhone,
      date,
      outboundCount: 1,
      outboundSegments: segments,
      estimatedCostUSD: costUSD,
    },
    update: {
      outboundCount: { increment: 1 },
      outboundSegments: { increment: segments },
      estimatedCostUSD: { increment: costUSD },
    },
  });
}
