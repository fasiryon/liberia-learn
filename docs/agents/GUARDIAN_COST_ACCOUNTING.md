# Guardian Per-Guardian SMS Cost Accounting (Sprint 6.1, escalation point 4)

STATUS: APPROVED with additions (2026-07-13), implemented -
`lib/agents/sms/smsCost.ts`, `GuardianSmsCostAccounting` table.

## Rate citation (requested at approval) - and a bigger finding underneath it
**Africa's Talking does not support Liberia at all.** Checked against their
official published country-coverage list
(https://help.africastalking.com/en/articles/2727792, confirmed 2026-07-13):
SMS is supported for Kenya, Uganda, Tanzania, Rwanda, Malawi, Zambia,
Nigeria, Cote d'Ivoire, Ethiopia, Ghana, South Africa - Liberia is not
listed. This is not "pricing isn't public," it's "the product isn't offered
there." **This means the "AT" in this sprint's own naming
(`/api/webhooks/sms-inbound`'s Africa's Talking format,
`AT_API_KEY`/`AT_USERNAME` in `lib/sms.ts`, `docs/agents/SMS_VERIFICATION_CHECKLIST.md`'s
"Africa's Talking Liberia number") describes a provider that cannot actually
serve this pilot.** `lib/sms.ts` already has a working fallback path -
`TwilioSMSProvider` - which fires automatically whenever `AT_API_KEY`/
`AT_USERNAME` are unset, which they are (correctly, since AT can't be
configured for a country it doesn't support).

Given that, the cited rate used for cap math (`SMS_RATE_USD_PER_SEGMENT` in
`lib/agents/sms/smsCost.ts`) is **Twilio's published Liberia rate**, the
provider actually reachable today:
- Twilio: **$0.2677/segment**, both outbound and inbound -
  https://www.twilio.com/en-us/sms/pricing/lr (checked 2026-07-13)

For comparison, a per-message pricing roundup (sent.dm, dated January 2025 -
https://www.sent.dm/en/resources/sms-pricing/liberia-sms-pricing) lists
substantially cheaper alternatives that are **not wired in this codebase**:
Orange Liberia's direct local API ~$0.0475-$0.06/segment, Plivo ~$0.0085,
Sinch ~$0.1199, Infobip ~$0.1604. Orange Liberia direct is roughly 4-5x
cheaper than Twilio. **This is worth a real decision before pilot budget
commits to Twilio by default** - not resolved here, since evaluating/wiring
a new SMS provider is a larger change than this spec's scope. The rate
constant has an env override (`GUARDIAN_SMS_RATE_USD_PER_SEGMENT`) so
switching providers later doesn't require a code change, only a number.

## Safeguarding exception (requested at approval)
Implemented: `sendCappedReply()` in `lib/agents/sms/guardianInbound.ts`
checks `result.toolCalls` for a successful `safeguarding.escalate` call and,
if found, passes `bypassCap: true` - the reply always sends regardless of
that guardian's or the platform's daily cap. Spend is still recorded for
reporting accuracy; only the cap *enforcement* is bypassed.

## Why this is an escalation point
Billing at scale: SMS delivery cost is a real per-message operating expense
distinct from (and currently untracked alongside) the LLM cost caps already
enforced by the agent runtime. Getting this wrong either lets costs run away
silently or, if too conservative, silently drops real guardian messages.

## What's NOT yet known - needs confirmation before implementation
**Africa's Talking's actual per-segment SMS rate for Liberia is not
documented anywhere in this repo and was not verified against AT's live
pricing/account during this sprint.** Do not implement caps against a
fabricated number. Before implementation: pull the current rate from the
Africa's Talking dashboard/API for the account that will hold the Liberia
number (`AT_API_KEY`/`AT_USERNAME`, referenced in `lib/sms.ts` but not yet
provisioned per `docs/agents/SMS_VERIFICATION_CHECKLIST.md`), for both
inbound (usually free to receive) and outbound (billed) legs.

## Multi-segment billing
Standard GSM SMS billing applies: a message is billed in 160-character
segments (153 if the message uses GSM multi-part concatenation headers, fewer
if it contains characters outside the GSM-7 alphabet, forcing UCS-2 encoding
at 70 chars/segment). This is exactly why the system prompt
(`lib/agents/prompts/liberialearn-family.md`) already constrains replies to
"target 160 characters, allow up to 3 segments" - a 3-segment reply is ~3x
the cost of a 1-segment reply. **Recommendation:** track segment count (not
just message count) in whatever cost-accounting table this spec produces,
since two guardians sending the same number of *messages* can cost very
different amounts if one guardian's questions produce longer answers.

## Proposed data model
A new table, analogous to the agent platform's existing
`AgentCostAccounting` (day + agentName rollup) but scoped to guardian +
day, e.g.:

```
model GuardianSmsCostAccounting {
  id              String   @id @default(cuid())
  guardianId      String?  // null until Deliverable 5 lands (phone may be unverified)
  guardianPhone   String
  date            DateTime @db.Date
  inboundCount    Int      @default(0)
  outboundCount   Int      @default(0)
  outboundSegments Int     @default(0)
  estimatedCostUSD Float   @default(0)

  @@unique([guardianPhone, date])
}
```
(Illustrative - not created. This is a genuinely new table, safe to add
under the "agent-platform tables are safe to alter" carve-out, but the shape
should be confirmed against whatever rate/segment data comes back from the
AT account check above before committing to columns.)

## Per-guardian daily cap
**Recommendation, pending the real per-segment rate:** cap outbound segments
per guardian per day, not just message count (since a guardian asking one
very open-ended question can trigger a 3-segment reply, effectively 3x a
short one). A reasonable starting point mirroring the existing SMS-throttle
convention already in `lib/guardian/sms-service.ts` (`SMS_THROTTLE_MAX_PER_WINDOW`,
default 3 messages/24h for guardian digest-type sends) would be similarly
conservative for the agent - **suggest 10 outbound segments/guardian/day**
as a starting pilot cap, tunable via env var following the existing
`SMS_THROTTLE_*` pattern, not hardcoded.

## Total daily cap across all guardians
Mirror the agent's existing `perDayTotalUSD: 50.00` LLM cap
(`lib/agents/agents/liberialearn-family.agent.ts`) with an equivalent SMS-cost
cap, checked the same way `checkCostCaps` checks LLM spend today (pre-send,
not post-hoc) - likely a new `checkSmsCostCaps` alongside the existing
`lib/agents/costEnforcement.ts`, reusing the same day-key/rollup pattern.

## What happens when a cap is hit
**Recommendation:** per-guardian cap hit -> the agent still runs (LLM cost is
separately capped and cheap), produces its normal response, but the SMS send
is suppressed and replaced with **one** fixed low-cost notice
("You've reached today's message limit. Try again tomorrow, or contact the
school directly.") - not silent failure, and not an unbounded stream of "you
hit the limit" messages (that notice itself must be idempotent/rate-limited
to at most once per guardian per day, or it becomes the same cost problem
one level up). Total daily cap hit -> the same fallback applies platform-wide;
given `perDayTotalUSD: 50/month-scale pilot`, this should be rare and worth an
`EscalationQueue` (`LOW` priority) entry so an admin notices before it
recurs, not just a silent drop.

## Reporting: admin dashboard for cost per guardian, cost per school
The existing agent admin dashboard (Sprint 6.0d, `lib/agents/admin/stats.ts`)
already aggregates `AgentCostAccounting`/`AgentInvocation` for LLM spend by
agent/day. A guardian SMS cost view would be a parallel read against the new
`GuardianSmsCostAccounting` table (once it exists), joined through
`StudentGuardian` -> `Student` -> `User.schoolId` for the per-school rollup.
Not built - flagged as the natural extension of the existing admin dashboard,
not a new subsystem.

## Concrete finding: agent replies currently bypass SMSDeliveryLog entirely
`SMSDeliveryLog` (used by `sendGuardianSMS`/the weekly digest) requires
non-nullable `schoolId`, `studentId`, `guardianId` - all of which come from a
resolved, verified guardian identity. Deliverable 4's webhook/simulator path
sends agent replies via the lower-level `lib/sms.ts: sendSMS(to, body)`
instead, specifically because identity isn't resolved yet
([[GUARDIAN_IDENTITY_VERIFICATION]] is blocked) and because an open-ended
conversational reply doesn't map cleanly onto `sendGuardianSMS`'s
consent/messageType/tenant-isolation model built for templated digest sends.
**Net effect: right now, zero SMS delivery or cost logging happens for agent
replies** - not even a message count, let alone segments or estimated cost.
This spec's implementation needs to decide whether agent replies migrate onto
`SMSDeliveryLog` (once Deliverable 5 resolves guardianId, extending that
table with `segments`/`estimatedCostUSD` columns would avoid a parallel
table) or get their own lighter-weight log that doesn't require a resolved
guardian identity (needed for the reply that happens *before* verification
succeeds, e.g. the cold-contact greeting itself, which also costs a segment
and today is completely unaccounted for).

## Resolution (2026-07-13)
1. **Resolved, with a bigger caveat than expected** - see rate citation
   above. No real Liberia AT rate exists to confirm; Twilio's is used and
   cited instead, flagged as provisional pending an actual provider decision.
2. **Built as a new table** (`GuardianSmsCostAccounting`, phone-keyed) rather
   than extending `SMSDeliveryLog` - agent replies still bypass
   `SMSDeliveryLog` entirely (unchanged from the finding below; that
   migration wasn't in scope of what was approved), and the new table needs
   to key by phone (not guardianId), covering unverified/pre-challenge
   traffic that `SMSDeliveryLog`'s non-nullable `guardianId` can't represent.
3. **Approved as proposed**: 10 segments/guardian/day
   (`GUARDIAN_SMS_DAILY_SEGMENT_CAP`, env-overridable). Total daily cap set
   to 180 segments/day (`GUARDIAN_SMS_TOTAL_DAILY_SEGMENT_CAP`) - chosen to
   roughly match the existing $50/day LLM cost-cap order of magnitude at the
   Twilio rate (50 / 0.2677 ~= 187, rounded down). Revisit once a real
   provider/rate is confirmed - at Twilio's rate this pilot-scale cap already
   implies real budget exposure (~$48/day at full utilization).
4. **Implemented**: `checkSmsCostCap()` suppresses the send (logged as a
   warning, not user-visible) when either cap is hit - no separate "you hit
   your limit" SMS is sent (would itself consume budget and risk the same
   problem one level up), per the "not silent" caveat being satisfied by the
   admin-visible log/report rather than a guardian-facing message. Revisit if
   pilot feedback shows a silent drop reads as the service being broken.
