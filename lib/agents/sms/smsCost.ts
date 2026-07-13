/**
 * Per-guardian SMS delivery cost accounting (Sprint 6.1, escalation point 4 -
 * APPROVED with the rate-citation and safeguarding-exception clarifications
 * below). docs/agents/GUARDIAN_COST_ACCOUNTING.md.
 *
 * IMPORTANT PROVIDER FINDING: Africa's Talking does not support Liberia at
 * all (confirmed against their published country-coverage list, 2026-07-13 -
 * no Liberia SMS product exists to price). The rate cited here is Twilio's
 * published Liberia rate, because lib/sms.ts's actual live fallback (when
 * AT_API_KEY/AT_USERNAME are unset, which they are - AT isn't viable) is
 * TwilioSMSProvider. This is the honest, citable number for a provider that
 * is actually wired and reachable today, NOT necessarily the final answer -
 * Orange Liberia's direct API was found priced roughly 4-5x cheaper
 * ($0.0475-$0.06/segment vs Twilio's $0.2677) and is worth evaluating before
 * committing pilot budget to Twilio by default. See GUARDIAN_COST_ACCOUNTING.md
 * for the full citation trail.
 */
import { prisma } from "@/lib/db";

/** USD per SMS segment, Twilio published rate for Liberia (+231), both
 * outbound and inbound. Source: https://www.twilio.com/en-us/sms/pricing/lr
 * (checked 2026-07-13). Override via env once the actual production
 * provider/rate is confirmed. */
export const SMS_RATE_USD_PER_SEGMENT = Number(process.env.GUARDIAN_SMS_RATE_USD_PER_SEGMENT ?? 0.2677);

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
  const costUSD = segments * SMS_RATE_USD_PER_SEGMENT;
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
