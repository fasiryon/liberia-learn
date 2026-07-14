# Orange Liberia Fallback Behavior (Orange Liberia integration, escalation point)

STATUS: DRAFT - awaiting review. Not implemented. `OrangeSMSProvider.send()`
currently behaves like every other provider on failure: returns
`{ ok: false, error, retryable }` to its caller with no cross-provider
fallback or alerting beyond what already exists (a caller-level warn log -
see `lib/agents/sms/guardianInbound.ts:sendReply`). This document is about
whether to add something beyond that, not a description of what ships today.

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

## Recommendation
**Option A (alert and stop)** for guardian-facing messages, consistent with
the sprint brief's own lean. The cost-tracking and correlation problems in
Option B are solvable but add real complexity for a failure mode (provider
outage) that should be rare and is better surfaced to a human than papered
over automatically - matching the same philosophy already applied to
`safeguarding.escalate` (never silently take an action that could confuse
what actually happened).

If approved, "alert" needs a concrete mechanism - options, not yet decided:
- A `logger.error` plus an existing metric event (`recordMetricEvent`,
  already used elsewhere in the SMS stack) that ops dashboards can alert on.
- An `EscalationQueue` entry (LOW/MEDIUM) if delivery failures should be
  reviewable the same way safeguarding/phone-update requests are - probably
  overkill for a single failed send, more appropriate if failures cluster
  (e.g. N failures in an hour).

## Questions for the human
1. Approve Option A (alert and stop) as proposed, or Option B (auto-fallback
   to Twilio) despite the cost/correlation tradeoffs?
2. If Option A: which alert mechanism - metric event, EscalationQueue entry,
   both, or something else? At what failure threshold (every failure, or
   only clusters)?
3. Does this apply to ALL Orange sends, or specifically guardian-facing ones
   (as opposed to, say, a future non-guardian bulk-SMS use of Orange, if one
   ever exists)?
