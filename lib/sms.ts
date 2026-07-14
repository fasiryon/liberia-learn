// lib/sms.ts - Backward-compatible wrapper for SMS sending.
import type { SMSProvider } from "@/lib/sms/provider";
import { TwilioSMSProvider } from "@/lib/sms/providers/twilio";
import { DryRunSMSProvider } from "@/lib/sms/providers/dry-run";
import { AfricasTalkingSMSProvider } from "@/lib/sms/providers/africastalking";
import { OrangeSMSProvider } from "@/lib/sms/providers/orange";
import { isLiveSmsEnabled } from "@/lib/serverFlags";
import { recordSmsSendFailure } from "@/lib/sms/failureTracking";

/**
 * Config-driven provider selection (env var, not a code change to switch).
 * SMS_PROVIDER explicitly picks a provider. Unset falls back to the
 * pre-existing auto-detect behavior (Africa's Talking if configured, else
 * Twilio) - Orange is deliberately NOT part of auto-detect: this
 * integration makes it available, but switching to it by default is a
 * separate, later decision. Orange only activates via an explicit
 * SMS_PROVIDER=orange.
 *
 * Use this for one-way sends (e.g. the weekly digest via
 * lib/guardian/sms-service.ts). For the guardian agent's two-way
 * conversational replies, use `selectTwoWaySmsProvider` instead - see there
 * for why Orange must not be used for that leg even if SMS_PROVIDER=orange
 * is set globally.
 */
export function selectSmsProvider(): SMSProvider {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (explicit === "orange") return new OrangeSMSProvider();
  return selectTwoWaySmsProvider();
}

/**
 * Provider selection for the guardian agent's two-way conversational
 * replies specifically (lib/agents/sms/guardianInbound.ts). Orange is
 * confirmed outbound-only - no documented mobile-originated/inbound
 * endpoint across 4 official Orange developer pages (see
 * lib/sms/providers/orange.ts and docs/agents/GUARDIAN_COST_ACCOUNTING.md).
 * A guardian's reply can currently only arrive via Twilio's webhook, so
 * using Orange for the OUTBOUND leg of that same conversation would be
 * misleading (the conversation's effective "provider" would silently
 * split). This function therefore never selects Orange, even if
 * SMS_PROVIDER=orange is set for the one-way digest path - it falls back
 * to the pre-existing Twilio/AT auto-detect regardless.
 */
export function selectTwoWaySmsProvider(): SMSProvider {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (explicit === "twilio") return new TwilioSMSProvider();
  if (explicit === "africastalking" || explicit === "africa's talking") return new AfricasTalkingSMSProvider();

  // Africa's Talking does not support Liberia (see
  // lib/sms/providers/africastalking.ts) - this branch is unreachable for
  // real Liberia traffic, kept only because AT_API_KEY/AT_USERNAME are an
  // existing checked env convention elsewhere in the app.
  return AfricasTalkingSMSProvider.isConfigured() ? new AfricasTalkingSMSProvider() : new TwilioSMSProvider();
}

async function sendVia(
  provider: SMSProvider,
  to: string,
  body: string
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const result = await provider.send({ to, body });

  if (!result.ok) {
    // Alert-and-stop (approved Orange fallback behavior): no auto-fallback
    // to another provider on failure.
    await recordSmsSendFailure(provider.name, { scope: "national", scopeId: null }, { error: result.error ?? null });
  }

  return { ok: result.ok, sid: result.providerMessageId, error: result.error };
}

export async function sendSMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  // Gate: if live SMS is not explicitly enabled, route to the dry-run provider.
  if (!isLiveSmsEnabled()) {
    const dryRun = new DryRunSMSProvider();
    const result = await dryRun.send({ to, body });
    return { ok: result.ok, sid: result.providerMessageId, error: result.error };
  }

  return sendVia(selectSmsProvider(), to, body);
}

/** For the guardian agent's two-way conversational replies - see
 * `selectTwoWaySmsProvider` for why this never uses Orange. */
export async function sendTwoWaySMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!isLiveSmsEnabled()) {
    const dryRun = new DryRunSMSProvider();
    const result = await dryRun.send({ to, body });
    return { ok: result.ok, sid: result.providerMessageId, error: result.error };
  }

  return sendVia(selectTwoWaySmsProvider(), to, body);
}
