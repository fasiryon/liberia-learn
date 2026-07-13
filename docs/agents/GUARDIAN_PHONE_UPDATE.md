# Guardian Phone Number Update (Sprint 6.1, escalation point 2)

STATUS: DRAFT - awaiting human review. Not implemented.

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

## Questions for the human
1. Confirm "principal/admin only, with audit trail" as the update path, and
   point to (or confirm need to build) the actual admin UI/route that performs
   it - Deliverable 6 stops here without knowing whether this already exists.
2. Confirm the old-number conversation-state cleanup should be part of that
   admin action's implementation (not the agent platform's).
3. Is `guardian.flagForTeacher` the right delivery mechanism for "guardian
   wants a phone update," or should this go to a different queue (it's not a
   teacher-facing message, it's an admin/principal action)? Given there's no
   PRINCIPAL Role in the schema (see [[GUARDIAN_SAFEGUARDING]]), this may need
   the same "who exactly gets notified" answer as the safeguarding spec.
