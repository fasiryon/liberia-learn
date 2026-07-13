# Guardian Identity Verification (Sprint 6.1, escalation point 1)

STATUS: APPROVED and implemented (2026-07-13). Known-number resolution +
Student-ID/name challenge live in `lib/agents/sms/identityVerification.ts`,
wired into `lib/agents/sms/guardianInbound.ts`.

## Name-matching clarification (requested at approval)
`matchesGuardianChallengeName()` (`lib/agents/sms/nameMatch.ts`) strips
diacritics (Unicode NFD decomposition), is case/punctuation-insensitive, and
allows a single-token partial name - "Pewu" matches "Pewu Gongloe" - since
the Student ID has already narrowed the search to one specific student, so
the name is a confirmation factor, not the primary identifier. Tokens longer
than 3 letters tolerate small edit-distance typos (Levenshtein <=1 for
tokens under 7 letters, <=2 for longer ones); tokens of 3 letters or fewer
require an exact match, since fuzzy-matching short strings produces too many
false positives to mean anything. This is a **general algorithm, not a
hardcoded table of Liberian name variants** - no verified source for such a
table exists in this repo, and a general approach degrades gracefully
instead of silently failing on a name pattern it wasn't specifically primed
for. Revisit if real pilot usage shows systematic false negatives on
specific name patterns.

## Operational caveat found during implementation
There is no human-facing "Student ID" field in the schema separate from
`Student.id` (an internal Prisma cuid, e.g. `ckx7h2j...`). The challenge
literally uses that string. **This means schools must hand guardians the
actual internal ID** (e.g. printed on an enrollment card) for the challenge
to be usable - not a code gap, but a rollout/ops item worth flagging before
pilot: is there an existing enrollment artifact that already prints this ID,
or does one need to be created?

## Why this is an escalation point
Security-sensitive (this is the only gate between an arbitrary SMS sender and a
child's academic/attendance data) and expensive to change post-pilot (guardians
will learn whatever flow ships first; changing it after go-live means re-training
real users, not just code).

## Current schema reality (verified, not assumed)
- There is no standalone `Guardian` model. A guardian is a `User` with
  `role = GUARDIAN`, linked to a `Student` via `StudentGuardian(studentId,
  guardianId, relation?)`, `@@unique([studentId, guardianId])` - **no** unique
  constraint on `studentId` alone, so a student already supports multiple
  guardian rows today. (See [[GUARDIAN_MULTI_HOUSEHOLD]].)
- The guardian's phone lives on `User`: `guardianCountryCode` (default `+231`),
  `guardianPhone`, `guardianPhoneE164`, `preferredChannel`, `smsOptIn`. There is
  no separate "verified phone" flag on `User` today - `guardianPhoneE164` is
  whatever was entered at enrollment/onboarding, not independently confirmed.
- `GuardianConversation` (new, Sprint 6.1) is keyed on `guardianPhone` (E.164)
  and has `guardianId String?`, `verifiedAt DateTime?`,
  `verificationAttempts Int @default(0)` - fields exist, semantics don't yet.
  It deliberately has **no** Prisma relation from `guardianId` to `User` yet,
  so approving this spec is also where that relation gets formalized.

## Proposed flow

### 1. Known number - phone matches an existing guardian's `User.guardianPhoneE164`
Immediate access: set `GuardianConversation.guardianId = user.id`,
`verifiedAt = now()` for this conversation. No challenge needed - the phone
number on file was already collected during enrollment (by a teacher/admin, in
person or via a paper form), which is a stronger provenance signal than
anything obtainable over SMS.

**Open question for the human:** is `guardianPhoneE164` data quality good
enough to trust for this? If a meaningful fraction of records are stale
(guardian changed SIM, number entered wrong at enrollment), "known number"
false-negatives will look like the bot not recognizing a real guardian on their
first message, which is a bad first impression. Worth a one-time query against
prod data (`count(*) where guardianPhoneE164 is not null`) before committing to
this as the primary path.

### 2. Unknown number, cold contact
Reply with the system prompt's cold-contact-unknown-number greeting (already
shipped, inert): "I do not recognize your number. Please reply with your
child's Student ID and their full name so I can verify you."

### 3. Unknown number, valid challenge response
Match `Student ID` -> `Student.id`, confirm the supplied name matches
`Student.user.name` (case-insensitive, whitespace-normalized), then confirm the
*matching Student* has **some** `StudentGuardian` row (any guardian, since the
caller hasn't claimed to be a specific one) - actually verifying *which*
guardian this is is not possible from Student ID + name alone, since siblings
share nothing that identifies which parent is texting.

**This is the crux design question:** if the challenge only proves "you know
this student's ID and name," it does not prove "you are *a* guardian of this
student" - a classmate, a nosy neighbor, or the student themself could pass it.
Two options:
- **(a) Trust it anyway**, on the theory that Student ID + full name is not
  public information the way a teacher/school/class name is (per the sprint's
  own instruction to exclude those), and require it to be an *exact* match on
  both fields, which meaningfully raises the bar. Grant access scoped to
  *that one student only* for this conversation (do not resolve to a specific
  `User.id` guardian record at all - just unlock `guardian.*` tool calls for
  that `studentId`, with `ctx.userId` left null and tool auth changed to also
  accept a per-conversation studentId grant). This requires a change to
  `assertGuardianOf` beyond what Sprint 6.1 shipped (currently
  strictly `StudentGuardian(studentId, guardianId=ctx.userId)`).
- **(b) Require Student ID + name to *also* match a specific guardian's own
  name or a secondary factor** (e.g., ask which relation - "mother," "father,"
  "guardian" - matching `StudentGuardian.relation`), closer to a real second
  factor but adds friction and `StudentGuardian.relation` is nullable/free-text
  today, not reliably populated.

**Recommendation: (a)**, with the "verify for this conversation only" rule
from the sprint brief (do NOT persist `guardianId` on
`GuardianConversation` for a challenge-based verification - only for the
known-number path). This keeps a wrong verification blast-radius limited to
one phone number's conversation, not a permanent identity binding.

### 4. Unknown number, failed challenge
Rate limit: 2 attempts/hour, 5/day, then temporary block (reject silently or
with a fixed "too many attempts, try again later" message - **recommend the
message**, so a legitimate guardian who mistyped doesn't think the service is
broken). Increment `GuardianConversation.verificationAttempts`; block by
checking attempts + a rolling timestamp window (needs a small addition:
either an `attemptTimestamps Json` array on `GuardianConversation.state`, or a
dedicated `lastAttemptAt`/`attemptWindowStart` column - **not yet in schema**,
needs to be added when this spec is implemented).

### 5. Failed-attempt / block logging
Every failed challenge and every block event goes to `EscalationQueue`
(`priority: "LOW"`, reusing the existing mechanism from Sprint 6.1's
`safeguarding.escalate` - same `enqueueEscalation` helper, different reason
string) for admin review. This is cheap (the table and helper already exist)
and gives early signal on whether the challenge is too easy (spam/abuse) or
too hard (real guardians locked out).

### 6. Multi-guardian household
Per [[GUARDIAN_MULTI_HOUSEHOLD]]: verify the caller matches (or is granted
access to) the student, not "all guardians" - the schema already supports N
guardians per student, so this flow does not need to enumerate or disambiguate
between them for the known-number path (the phone number IS the guardian
identity in that case) or the challenge path (option (a) above grants
per-student access, sidestepping the need to pick a specific guardian row).

### 7. Explicit exclusion (from the sprint brief, confirmed correct)
Never verify via information a child could post publicly - teacher name,
school name, class name. Only Student ID + full name are used as the
challenge, per section 3.

## Resolution (2026-07-13)
1. **Approved**: option (a) implemented - `ToolContext.grantedStudentIds`,
   `assertGuardianOf` checks it before falling back to the `StudentGuardian`
   DB join.
2. Not separately re-litigated at approval; shipped as originally proposed
   (known-number is the primary fast path). Revisit if pilot data shows
   `guardianPhoneE164` quality issues.
3. Implemented as `state.verification.attemptTimestamps` inside
   `GuardianConversation.state` JSON, not new typed columns - simpler given
   the low query need at pilot scale (EscalationQueue already gets a row per
   failed/blocked attempt for admin visibility, which is queryable normally;
   the JSON blob is only ever read back for the same phone number's own rate
   check, never queried across guardians).
4. **Approved as proposed**: 2/hour, 5/day.
