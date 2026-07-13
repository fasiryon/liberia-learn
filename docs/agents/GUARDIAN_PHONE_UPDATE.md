# Guardian Phone Number Update (Sprint 6.1, escalation point 2)

STATUS: APPROVED and implemented (2026-07-13). `guardian.requestPhoneUpdate`
tool (`lib/agents/tools/guardian.tools.ts`) - agent refuses to change the
number itself, flags an `EscalationQueue` entry (LOW) plus an inbox
notification to `ADMIN`-role users at the guardian's school. Requires a
resolved known-number identity (`ctx.userId`); a challenge-only grant has no
`User.id` to attach the request to, so it isn't offered in that state.

## Why this is an escalation point
Data integrity: `User.guardianPhoneE164` is the anchor identity signal for the
"known number" path in [[GUARDIAN_IDENTITY_VERIFICATION]]. Letting the wrong
actor change it hands them permanent access to a child's data, not just
one conversation's worth.

## The question
How does a guardian update their phone number when they change SIM/provider
(common in Liberia - prepaid SIMs, shared phones, lost phones)?

## Recommendation: no, the agent does not update it directly
Even after a successful Student-ID-+-name challenge
([[GUARDIAN_IDENTITY_VERIFICATION]] option (a)), that challenge proves
"knows this student's ID and name," not "is the specific guardian whose
number is on file." Letting a challenge-only verification rewrite
`User.guardianPhoneE164` would let anyone who passes the (deliberately
low-friction) challenge silently take over the known-number fast path for
future conversations - a privilege escalation from "temporary, per-conversation
access" to "permanent identity."

**Proposed flow:**
1. Guardian texts from a new/unrecognized number, passes the Student-ID +
   name challenge (temporary, per-conversation access per
   [[GUARDIAN_IDENTITY_VERIFICATION]]).
2. If the guardian says something like "this is my new number" / asks to
   update it, the agent does **not** act on this. It replies with a fixed,
   scoped message (something like: "I can't change phone numbers over SMS.
   Please ask the school to update your number.") and, separately,
   `guardian.flagForTeacher` (or a small variant scoped to admin/principal
   instead of the subject teacher - TBD, see open question) creates a record
   a human can act on.
3. **Principal or admin only, with an audit trail**, updates
   `User.guardianPhoneE164` through the existing admin/teacher UI (need to
   confirm this UI exists today - `guardianPhoneE164` is currently set at
   enrollment; a dedicated "update guardian phone" admin action may not exist
   yet and would need to be built or confirmed as in-scope for someone else).
   This write should go through `logAudit` (existing helper, already used
   throughout the agent platform) so there's a record of who changed it, when,
   and why.

## Old number's conversation state
When a guardian's number changes and the school updates `guardianPhoneE164`
to the new number:
- The **old** `GuardianConversation` row (keyed by the old phone number)
  becomes orphaned - it still exists, still has whatever `guardianId`/
  `verifiedAt` it had, and would still resolve to "known number" for anyone
  who now holds that recycled SIM. **This is the actual risk** phone-number
  recycling is common in Liberia; a guardian's abandoned SIM can be
  re-issued to a stranger by the carrier within weeks.
- **Recommendation:** when an admin updates `User.guardianPhoneE164`, the
  update path should also clear/expire the `GuardianConversation` row for the
  *old* number (set `guardianId = null`, `verifiedAt = null`, or delete the
  row outright) so a recycled SIM does not inherit known-number trust. This
  needs to be a deliberate step in whatever admin action performs the update,
  not something the agent platform can enforce on its own since the update
  doesn't happen through agent tooling.

## Race condition: two callers both claim to be "the guardian" with different numbers
E.g., both parents in a household text from their own numbers, one from a
number already on file (known-number, immediate access) and one from an
unknown number (challenge flow). This is not actually a conflict under the
current multi-guardian schema
([[GUARDIAN_MULTI_HOUSEHOLD]] - `StudentGuardian` already supports N rows per
student) **as long as both are legitimately guardians of the same student**.
The harder case is two *different* numbers both trying to claim the *same*
`StudentGuardian` row / the *same* identity update ("this is my new number,
the old one is dead" from two different callers). Given the "no direct
agent-side update" recommendation above, this resolves itself: both callers
get told to go through the school, and a human resolves the conflict with
whatever verification a school already does in person (ID, enrollment
records) - not a problem the agent platform needs to solve.

## Resolution (2026-07-13)
1. **Approved**: admin-only with an audit trail (`enqueueEscalation` +
   `logAudit` pattern, consistent with the rest of the agent platform). The
   actual admin UI/route that performs the `guardianPhoneE164` write was
   **not confirmed to exist** during this sprint - the agent-side flagging
   is built and shipped, but whoever picks up the `EscalationQueue`/inbox
   notification today has to make the Prisma write by hand (or via existing
   generic admin tooling, if any) until a dedicated route exists. Not
   blocking for this sprint per the approval, but real friction until fixed.
2. Not yet built - the old-number `GuardianConversation` cleanup depends on
   the admin action from item 1 existing first. Tracked as a dependency, not
   implemented.
3. **Resolved**: neither `guardian.flagForTeacher` nor a safeguarding-style
   queue - built as its own tool (`guardian.requestPhoneUpdate`) writing to
   `EscalationQueue` (LOW priority) plus `createInboxNotification` for
   `ADMIN`-role users at the guardian's school. This sidesteps the "no
   PRINCIPAL role" question because ADMIN is a proportionate proxy for a
   routine, low-stakes request - unlike safeguarding, where the user
   explicitly wants a higher bar (a designated safety-staff field) before
   shipping notification.

## Doc B: fast principal phone-update flow (requested at approval, not built)
The approved-with-clarification note asked for a **fast** principal
phone-update path, since "ask the school, they'll follow up" implicitly
risks becoming a week-long turnaround if the only mechanism is a generic
admin queue. Not designed or built this sprint. Sketch for a future pass:
a dedicated `/admin/guardian-phone-updates` inbox view (read `EscalationQueue`
filtered to `reason LIKE 'guardian phone-update request%'`) with a one-click
"update number" action that writes `User.guardianPhoneE164` directly (with
`logAudit`) and invalidates the old `GuardianConversation` row in the same
transaction - collapsing today's two-step "notice -> manual Prisma write"
into one UI action for the person who already gets notified. Needs product
input on where this UI lives (school-scoped admin dashboard vs. a shared
platform-admin surface) before it's built.
