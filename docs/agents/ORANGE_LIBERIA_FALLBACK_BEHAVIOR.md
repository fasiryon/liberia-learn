# Orange Liberia Fallback Behavior (Orange Liberia integration, escalation point)

STATUS: **APPROVED and implemented (2026-07-14).**
1. **Option A (alert and stop)** - no auto-fallback to Twilio on failure.
   Unchanged from before: `OrangeSMSProvider.send()` (and every other
   provider) just returns `{ ok: false, error, retryable }`.
2. **Alert mechanism**: `lib/sms/failureTracking.ts:recordSmsSendFailure()`
   - a metric event (`MetricEvent` name `"sms.failed"`, tagged with
   `provider`) on every failed send, always-on. When the SAME provider
   crosses 3 failures within a rolling 60-minute window, a `MEDIUM`
   `EscalationQueue` entry fires once per cluster (exactly at the 3rd
   failure in the window, not on every failure past it, so a sustained
   outage doesn't spam the queue).
3. **Scope**: wired into every current Orange-reachable send path - both
   `lib/sms.ts:sendSMS()` (guardian agent conversational replies) and
   `lib/guardian/sms-service.ts:sendGuardianSMS()` (weekly digest and other
   templated guardian sends). `sendGuardianSMS`'s default provider changed
   from a hardcoded `TwilioSMSProvider` to `selectSmsProvider()` (the same
   `SMS_PROVIDER`-driven selection `lib/sms.ts` already used) - without
   this, Orange could never actually be selected for the digest path at
   all, which is its realistic near-term role (see the cost-accounting doc).
   No special-casing for a hypothetical future non-guardian use.

## The question
If `SMS_PROVIDER=orange` is the active provider and a send fails (network
error, Orange API error, expired/invalid airtime balance, rate limit), what
should happen?

## Option A: Alert and stop (recommended in the sprint brief)
On failure, do not silently retry against a different provider. Log/alert
loudly (a dedicated metric event or an `EscalationQueue`-style entry,
depending on severity) and let the send fail as it does today. The
guardian's SMS simply doesn't arrive; whatever caller-level retry/backoff
logic already exists for that message type is the only recovery path.

**Why this is the safer default, per the reasoning already given:** a
silent provider switch mid-operation would make delivery tracking
inconsistent - a message logged as "sent via Orange" that actually went out
via Twilio (or vice versa) breaks the assumption that `SMSDeliveryLog`/
`GuardianSmsCostAccounting`'s `guardianPhone`+provider pairing reflects
reality, and makes debugging a real delivery problem harder, not easier,
since the operator doesn't know which account/balance/rate limit actually
applies to a given message.

## Option B: Auto-fallback to Twilio
On Orange failure, immediately retry the same message via `TwilioSMSProvider`
instead. Guardian-facing delivery is more resilient to a single provider's
outage, at the cost of:
- Twilio's rate ($0.2677/segment) applies to that message instead of
  Orange's (~$0.06/segment) - a ~4.5x cost spike for messages that fail over,
  invisible unless specifically monitored.
- `GuardianSmsCostAccounting` (Sprint 6.1) records segments/cost by phone,
  not by provider - a fallback would need that table (or a new one) to also
  record which provider actually handled a given send, or the cost
  accounting silently mixes rates without anyone noticing budget drift.
- Complicates `providerMessageId` correlation for delivery-status tracking
  (Orange's `deliveryInfoNotification` webhook, once/if built, would never
  fire for a message that actually went out via Twilio).

## Resolution (2026-07-14)
1. **Option A approved as proposed.**
2. **Both mechanisms, as suggested**: always-on metric event per failure,
   `EscalationQueue` MEDIUM specifically at a 3-failures/60-minutes-per-
   provider cluster threshold (not LOW - clustered delivery failures are a
   real operational signal, not background noise).
3. **All current Orange-reachable sends** (guardian digest + guardian agent
   replies) - no special-casing for a hypothetical future non-guardian use.
   Implemented in `lib/sms/failureTracking.ts`, wired into both
   `lib/sms.ts:sendSMS()` and `lib/guardian/sms-service.ts:sendGuardianSMS()`.
   Tests: `__tests__/sms.failureTracking.test.ts`, plus coverage added to
   `__tests__/sms.test.ts` and `__tests__/guardian.sms.reliability.test.ts`.
