# Guardian Per-Guardian SMS Cost Accounting (Sprint 6.1, escalation point 4)

STATUS: DRAFT - awaiting human review. Not implemented. No rate limiting or
cost reporting beyond the agent-level `costLimits` already shipped in
Deliverable 1 (which cap LLM spend, not SMS delivery spend).

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

## Questions for the human
1. Confirm/provide the real Africa's Talking per-segment rate for Liberia
   (inbound and outbound) before any cap numbers are finalized - everything
   above is a structural proposal, not priced.
2. Approve the `GuardianSmsCostAccounting` table shape (or redirect to reuse
   `SMSDeliveryLog`, which already exists and is used by
   `lib/guardian/sms-service.ts` - possible this doesn't need a new table at
   all if `SMSDeliveryLog` already has enough columns to roll up by guardian
   + day. Worth checking before building a parallel table).
3. Approve 10 segments/guardian/day as the starting pilot cap (or supply a
   different number once real pricing is known).
4. Confirm the "one fixed fallback notice, not silent, not repeated" behavior
   for cap-hit.
