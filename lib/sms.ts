// lib/sms.ts - Backward-compatible wrapper for SMS sending.
import { TwilioSMSProvider } from "@/lib/sms/providers/twilio";
import { DryRunSMSProvider } from "@/lib/sms/providers/dry-run";
import { AfricasTalkingSMSProvider } from "@/lib/sms/providers/africastalking";
import { isLiveSmsEnabled } from "@/lib/serverFlags";

export async function sendSMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  // Gate: if live SMS is not explicitly enabled, route to the dry-run provider.
  if (!isLiveSmsEnabled()) {
    const dryRun = new DryRunSMSProvider();
    const result = await dryRun.send({ to, body });
    return { ok: result.ok, sid: result.providerMessageId, error: result.error };
  }

  // Africa's Talking does not support Liberia (see
  // lib/sms/providers/africastalking.ts) - this branch is unreachable for
  // real Liberia traffic, kept only because AT_API_KEY/AT_USERNAME are an
  // existing checked env convention elsewhere in the app.
  const provider = AfricasTalkingSMSProvider.isConfigured() ? new AfricasTalkingSMSProvider() : new TwilioSMSProvider();
  const result = await provider.send({ to, body });
  return {
    ok: result.ok,
    sid: result.providerMessageId,
    error: result.error,
  };
}
