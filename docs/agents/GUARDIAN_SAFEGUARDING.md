# Guardian Safeguarding Escalation Integration (Sprint 6.1, escalation point 5)

STATUS: DRAFT - awaiting human review. Partially implemented: the
`safeguarding.escalate` tool (Deliverable 3) writes an `EscalationQueue` row
today. It does **not** notify anyone - this spec covers who gets notified, on
what channel, within what SLA, and legal considerations, none of which are
built yet.

## Why this is an escalation point
Child safety. This is the highest-consequence path in the entire sprint - a
false negative (a real safeguarding concern not escalated, or escalated but
nobody sees it in time) is a categorically different kind of failure than
every other deliverable in Sprint 6.1.

## What language patterns trigger safeguarding escalation?
Per the system prompt (`lib/agents/prompts/liberialearn-family.md`), this is
**deliberately the agent's own judgment call**, not a keyword/regex trigger -
"called only on your own judgment that a message describes a safeguarding
concern... never merely because the guardian asked you to escalate
something, and never skipped when the concern is real." This is the right
default (regex on "hurt"/"hit"/"missing" will both over-trigger on idioms and
under-trigger on paraphrase), but pure LLM judgment as the *only* safety net
is a single point of failure if the model mis-reads a message.

**Recommendation:** add a narrow, high-recall (not high-precision) keyword
safety net *in addition to* the agent's judgment, not instead of it - a
short list of terms (hurt, hit, abuse, threatened, missing, following, scared,
unsafe, self-harm and close variants) that, if present anywhere in an inbound
message, force a mandatory `safeguarding.escalate` call regardless of what
the agent's own reasoning concludes, even if the final classification is
`MEDIUM` rather than `HIGH`. This trades some false positives (a keyword
match on an unrelated message costs one `LOW`/`MEDIUM` queue entry - cheap)
for a hard floor under the "the LLM might just get it wrong" risk. This is
new code (not yet built) that would sit in `lib/agents/sms/guardianInbound.ts`
or a new `lib/agents/safeguarding/keywordGate.ts`, checked before/alongside
the agent's own tool-call decision.

## Who receives HIGH priority escalations?
**Concrete finding, not a design choice:** there is no `PRINCIPAL` value in
the `Role` enum today (`TEACHER | STUDENT | GUARDIAN | ADMIN |
DISTRICT_ADMIN | MOE_OFFICIAL | MOE_SUPER_ADMIN | MOE_DISTRICT_ADMIN`), even
though `AgentRole` (the agent-platform's own TS type, not the DB enum)
includes `"principal"` as an aspirational role. **"Notifies principal +
support inbox" cannot be implemented as literally specified because there is
no principal to notify.** This needs a human decision, not a workaround:

- **(a)** Treat `ADMIN` users scoped to the student's `schoolId` as the
  "principal" for notification purposes (a school's admin-role user is likely
  its principal or a delegate in this system's current org model). Query:
  `User.findMany({ role: "ADMIN", schoolId })`.
- **(b)** Add a real `PRINCIPAL` role or a `School.principalUserId` field -
  larger schema change, more accurate long-term, not needed to ship a pilot.
- **(c)** Route HIGH safeguarding escalations to a fixed, small,
  platform-level list (e.g. the sprint owner + designated support staff)
  regardless of school, for the pilot's small scale, rather than building
  per-school routing at all.

**Recommendation for pilot scale: (c)**, given the pilot is "first 5 schools"
per the flagship project scope - a fixed notification list is auditable,
simple, and avoids shipping (a) as a silent assumption that later turns out
wrong when a school's ADMIN user isn't actually the right safeguarding
contact.

**Delivery channel:** `createInboxNotification` (`lib/notifications/inboxService.ts`)
already exists for the "support inbox" half and requires no new
infrastructure - it needs `userId`s to notify (see above). Add SMS-to-specific-staff
as a second channel only if inbox-notification response time in
pilot proves too slow - not built now, since it multiplies the
cost-accounting question in [[GUARDIAN_COST_ACCOUNTING]] and adds outbound
SMS spend for a feature not yet validated as necessary.

## What does the agent tell the guardian while escalating?
Warm acknowledgment, next step, never dismiss - already specified in the
system prompt's out-of-scope handling. Concrete script needed (not yet
drafted precisely enough to ship): something like "I hear you, and this is
serious. I'm making sure someone at the school knows right away. If your
child is in immediate danger, please call [emergency contact] now." The
bracketed emergency contact needs a real number/authority before this ships -
**flagging, not filling in, since this is exactly the kind of detail that
must not be guessed.**

## SLA for human response to a HIGH escalation
Sprint brief suggests <1 hour during school hours. This is not enforceable by
the agent platform alone - `EscalationQueue` has `status`
(`OPEN|IN_PROGRESS|RESOLVED|CLOSED`) and `createdAt`/`resolvedAt`, so an SLA
*breach* is queryable (`status = OPEN AND createdAt < now() - 1h AND
priority = HIGH`), but nothing currently alerts on a breach. Recommend a
scheduled check (reusing the existing agent scheduler infrastructure from
Sprint 6.0c, `lib/agents/scheduler.ts`) that escalates a breach itself - e.g.
a second-tier notification if a HIGH item is still `OPEN` after 1 hour. Not
built; flagged as the natural mechanism once notification recipients (above)
are decided.

## Legal considerations: mandatory reporting in Liberia
**Not researched as part of this sprint - flagging explicitly rather than
guessing.** Liberia's Children's Law (2011) establishes child protection
obligations, and the Ministry of Gender, Children and Social Protection
operates a reporting structure, but the specific mandatory-reporting
obligations that would apply to a platform operator (as opposed to an
individual professional like a teacher) were not verified during this sprint
and should not be assumed. **This needs a real answer from someone with
Liberian child-protection legal/policy expertise (likely via the MOE
relationship this platform already has) before the safeguarding flow ships to
real guardians**, not an LLM-drafted legal summary. Recommend: raise this as
a standalone action item with the MOE contact, independent of and likely
slower than the rest of this sprint's engineering work - do not let it block
the code being ready, but do not flip `AGENT_GUARDIAN_ENABLED` to true in
production until it's answered.

## Questions for the human
1. Approve the keyword-gate safety net as an addition to (not replacement of)
   LLM judgment for triggering `safeguarding.escalate`.
2. Approve option (c) - fixed platform-level notification list - for pilot
   scale, and supply the actual user(s)/contact(s) to notify.
3. Supply the real emergency-contact information for the guardian-facing
   escalation acknowledgment script.
4. Confirm the SLA-breach re-escalation mechanism (scheduler-based check) is
   in scope for this spec's implementation, or should ship as a fast-follow.
5. Who owns getting a real answer on Liberian mandatory-reporting obligations
   before this goes live - and is that person/relationship already
   identified (MOE contact)?
