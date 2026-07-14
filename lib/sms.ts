// lib/sms.ts - Backward-compatible wrapper for SMS sending.
import type { SMSProvider } from "@/lib/sms/provider";
import { TwilioSMSProvider } from "@/lib/sms/providers/twilio";
import { DryRunSMSProvider } from "@/lib/sms/providers/dry-run";
import { AfricasTalkingSMSProvider } from "@/lib/sms/providers/africastalking";
import { OrangeSMSProvider } from "@/lib/sms/providers/orange";
import { isLiveSmsEnabled } from "@/lib/serverFlags";

/**
 * Config-driven provider selection (env var, not a code change to switch).
 * SMS_PROVIDER explicitly picks a provider. Unset falls back to the
 * pre-existing auto-detect behavior (Africa's Talking if configured, else
 * Twilio) - Orange is deliberately NOT part of auto-detect: this
 * integration makes it available, but switching to it by default is a
 * separate, later decision (it isn't even confirmed to support inbound SMS
 * yet - see lib/sms/providers/orange.ts). It only activates via an explicit
 * SMS_PROVIDER=orange.
 */
function selectSmsProvider(): SMSProvider {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (explicit === "orange") return new OrangeSMSProvider();
  if (explicit === "twilio") return new TwilioSMSProvider();
  if (explicit === "africastalking" || explicit === "africa's talking") return new AfricasTalkingSMSProvider();

  // Africa's Talking does not support Liberia (see
  // lib/sms/providers/africastalking.ts) - this branch is unreachable for
  // real Liberia traffic, kept only because AT_API_KEY/AT_USERNAME are an
  // existing checked env convention elsewhere in the app.
  return AfricasTalkingSMSProvider.isConfigured() ? new AfricasTalkingSMSProvider() : new TwilioSMSProvider();
}

export async function sendSMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  // Gate: if live SMS is not explicitly enabled, route to the dry-run provider.
  if (!isLiveSmsEnabled()) {
    const dryRun = new DryRunSMSProvider();
    const result = await dryRun.send({ to, body });
    return { ok: result.ok, sid: result.providerMessageId, error: result.error };
  }

  const provider = selectSmsProvider();
  const result = await provider.send({ to, body });
  return {
    ok: result.ok,
    sid: result.providerMessageId,
    error: result.error,
  };
}
