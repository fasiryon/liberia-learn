# Guardian Multi-Household Handling (Sprint 6.1, escalation point 3)

STATUS: APPROVED with additions (2026-07-13), implemented.

## Approved additions
- **Any verified guardian gets full, equal access to the student's school
  data.** The agent does not detect, mediate, or withhold information over
  guardian-vs-guardian disputes - that is a school matter. Encoded directly
  in the system prompt (`lib/agents/prompts/liberialearn-family.md`, under
  "Verification context" and the out-of-scope list) rather than in code -
  there was nothing to build, since `assertGuardianOf` already grants equal
  access to any linked guardian; the addition is a behavioral guarantee, not
  a new access-control mechanism.
- **Extended family (grandparents, aunts, uncles) get no agent access unless
  added as an explicit `StudentGuardian` record by school admin.** Already
  true by construction - `assertGuardianOf` only grants access via a
  `StudentGuardian` row or an active per-conversation challenge grant, never
  by relation/kinship inference. No code change needed; covered by the
  existing `guardianAuth.test.ts` rejection tests (an unlinked caller is
  rejected regardless of who they claim to be).
- **Safeguarding escalations go to the school, never automatically to other
  guardians.** Recorded as a locked-in constraint in
  `docs/agents/GUARDIAN_SAFEGUARDING.md` for whenever that spec's
  notification wiring is built (it isn't yet - Spec 5 is not approved).
  Also stated directly in the system prompt's safeguarding rule ("never
  mention or imply that another guardian will be told").

## Investigation: can a Student have multiple Guardian records today?
**Yes, already.** `StudentGuardian`:

```prisma
model StudentGuardian {
  id         String  @id @default(cuid())
  studentId  String
  guardianId String
  relation   String?
  guardian   User    @relation(fields: [guardianId], references: [id])
  student    Student @relation(fields: [studentId], references: [id])

  @@unique([studentId, guardianId])
}
```

The unique constraint is on `[studentId, guardianId]` together, **not** on
`studentId` alone - a student can have arbitrarily many `StudentGuardian`
rows (mother, father, aunt, etc.), each pointing at a different `User`. This
is not a Sprint 6.1 schema change; it's pre-existing and already used by the
guardian dashboard/messages/digest code (`lib/notifications/guardianDigest.ts`,
`app/api/guardian/messages/route.ts` both already query `guardianOf`/
`guardians` as a list). No migration needed for the data model itself.

## When two guardians of the same child both text, are conversation threads separate?
**Yes, structurally, for free.** `GuardianConversation` is keyed on
`guardianPhone` (one row per phone number), not on `studentId` or a
guardian-student pair. Two different guardians, texting from two different
phones, about the same child, get two independent `GuardianConversation`
rows with independent `state.messages` histories. There's no cross-talk risk
in the current design - each conversation is scoped to a phone number, and
(once [[GUARDIAN_IDENTITY_VERIFICATION]] is implemented) each is
independently verified/authorized against whichever student(s) that specific
phone's owner is a guardian of.

## Edge cases worth the human's attention (not blocked, but worth confirming)

**1. One guardian, multiple children.** Already handled - `assertGuardianOf`
checks per-`studentId`, and a single `GuardianConversation` can range across
any student the verified `guardianId` has a `StudentGuardian` row for. No
special handling needed; this was implicit in Deliverables 1-4 already.

**2. Same phone number used by two guardians (shared household phone).**
This is the one real gap. If a household has one phone and two guardians
(common with feature phones), `GuardianConversation.guardianPhone` is unique
per number, so the *first* verified guardianId "owns" that phone's
known-number fast path. A second guardian sharing the same phone would need
to go through the challenge flow every time (since the known-number match
would resolve to the first guardian's identity, not theirs) - actually worse:
under the known-number design in [[GUARDIAN_IDENTITY_VERIFICATION]], a shared
phone auto-grants access as *whichever* guardian's number was recorded first,
without asking who's actually texting. **This needs the same-phone-name
question:** does the agent ever ask "who am I speaking with, {GuardianA} or
{GuardianB}?" when a phone number is linked to more than one guardian? Given
Sprint 6.1's constraint is response-only, English-only, no proactive
messaging - a light disambiguation question ("Reply A for {name}, B for
{name}") is in-scope as a *response*, not a proactive message, and is the
recommended fix. Not implemented; deferred to identity-verification spec
approval since it touches the same resolution logic.

**3. Guardian relation field is unreliable.** `StudentGuardian.relation` is
free-text and nullable - can't be used to auto-select "the mother" vs "the
father" for anything (e.g. digest personalization, "Hi {guardianFirstName}"
greeting already uses `User.name`, which is fine and doesn't depend on
`relation`).

## Proposed handling
No schema change needed. When [[GUARDIAN_IDENTITY_VERIFICATION]] is
implemented:
- Known-number resolution should check whether **more than one** `User` shares
  the same `guardianPhoneE164` (a shared-household-phone signal) and, if so,
  ask which guardian is texting before granting tool access, rather than
  silently picking one.
- No other change to conversation-threading or tool authorization is needed -
  the per-phone-number, per-studentId model already generalizes to N
  guardians correctly.

## Resolution (2026-07-13)
Shared-household-phone disambiguation was **not** built as an active "Reply A
for X, B for Y" flow - not in scope of what was approved this round.
Implemented instead as the safer default floated in the original draft:
`resolveKnownGuardian()` (`lib/agents/sms/identityVerification.ts`) requires
**exactly one** `GUARDIAN` User to match the inbound phone number; if two or
more share it, the known-number path does not fire at all, and the caller
falls through to the Student-ID + name challenge instead (temporary,
per-conversation access, never silently bound to the wrong guardian's
identity). Revisit the "ask which guardian" UX if pilot data shows this
causes real friction for shared-phone households.
