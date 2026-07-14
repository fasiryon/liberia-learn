# Guardian Safeguarding Escalation Integration (Sprint 6.1, escalation point 5)

STATUS: **APPROVED and fully implemented (2026-07-14, closed 2026-07-14).**
Legal direction came back via counsel: **LiberiaLearn has no mandatory
reporting obligation.** The agent's role is detect, acknowledge, resource,
and alert the school, nothing more (see Gates below). All 6 gates (A-F) are
now done - Gate B's police number (the last open item from this sprint) was
confirmed 2026-07-14.

## Implementation gates (recorded verbatim from the direction, 2026-07-14)
A. **Done.** `School.designatedSafetyStaffUserId` (nullable, migration
   `20260713_000003_safeguarding_and_student_id`).
B. **Done (closed 2026-07-14).** 116 child-protection hotline and the
   police number are both real constants in
   `lib/agents/safeguarding/resources.ts`, both cited. Police number:
   **0770-800-911**, confirmed via an official Liberia National Police
   (LNP) public safety notice - Liberia's national operations number for
   police assistance, crime reporting, and emergency response. **911 is
   explicitly not in use in Liberia** - do not fall back to it anywhere.
   Repo-wide grep for "911" confirmed no other reference to it as a
   Liberia emergency number (one unrelated hit: a lesson-count table in
   `docs/ops/NR14_AUDIO_PIPELINE.md`).
C. **Done.** `lib/agents/safeguarding/keywordGate.ts` - deterministic,
   high-recall pattern list, checked before the LLM loop runs.
D. **Done.** `lib/agents/safeguarding/notify.ts` - ADMIN-role users at the
   school plus `designatedSafetyStaffUserId`, via existing inbox + push
   infrastructure (no new delivery channel built).
E. **Done.** Keyword-gate path always logs `EscalationQueue` at `HIGH`.
   The LLM-judgment path (`safeguarding.escalate` tool) still lets the
   agent choose `HIGH`/`MEDIUM` for its own judgment calls.
F. **Done.** `scripts/verify-guardian-agent-e2e.ts`, run twice against real
   prod demo data (guardian1@cha.family.lr / Pewu Gongloe, Grade 7,
   student code `C9T5CE4`). All 8 messages from the original Deliverable 10
   spec behave correctly: known-number greeting, weekly-report/progress
   answers with real mastery data, the safeguarding trigger (fixed 116
   acknowledgment, `EscalationQueue` HIGH, `NotificationInboxItem` for the
   school ADMIN), a warm follow-up after the safeguarding message, the
   unknown-number challenge, a successful Student-ID+name verification, and
   a post-verification follow-up. First run surfaced and fixed a real bug
   (below); second run passed clean. Also incidentally exercised Spec 4's
   cost cap for real: two replies were suppressed by the per-guardian daily
   segment cap mid-run, and the safeguarding reply still went through
   despite the cap already being hit, confirming the bypass works.

**Bug found and fixed during Gate F**: the known-number verification path
told the agent `[context: verified]` with no studentId at all (unlike the
challenge-grant path, which always included one). Every `guardian.*` tool
call requiring a studentId failed - the LLM invented a literal `"<id>"`
placeholder rather than asking or refusing. Fixed in
`lib/agents/sms/guardianInbound.ts`: the known-number path now resolves
every `StudentGuardian` link and includes each as
`{studentId=<id> name=<firstName>}` in the context line, so the agent has
real IDs to work with (and can ask which child, for a guardian with more
than one). System prompt updated to document the new context format and to
explicitly forbid inventing a studentId.

**Not addressed this round** (was blocking item 4 in the prior draft, not
in the new gate list, so left alone rather than inventing behavior): what
happens on an SLA miss. `EscalationQueue.status`/`createdAt` make a breach
queryable, but nothing alerts on one yet.

Everything below is the original proposal/analysis, kept for context, with
resolution notes inserted where the direction changed or confirmed it.

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

**Implemented (2026-07-14), per Gate C and Gate 5's "err on the side of
escalation" rule.** `lib/agents/safeguarding/keywordGate.ts`: a high-recall
pattern list (hurt/hit/abuse/threatened/missing/following/scared/unsafe/
self-harm/suicide/rape/molest/kidnap/trafficking and close variants),
checked in `lib/agents/sms/guardianInbound.ts` *before* the LLM loop runs at
all. A match short-circuits the entire message: no LLM call, a fixed
guaranteed-correct acknowledgment (real 116 number, no LLM paraphrase risk
under a 300-token cap), an `EscalationQueue` row at `HIGH`, and a school
notification, deterministically. The agent's own judgment (via
`safeguarding.escalate`) remains a second, LLM-driven catch-all for concerns
this list doesn't anticipate - a floor, not a replacement. False positives
are accepted by design (a keyword hit on an unrelated message costs one
`HIGH` queue entry, cheap and reviewable).

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

**Resolved (Gate A, 2026-07-14):** `School.designatedSafetyStaffUserId`
(single person per school, nullable at the DB level, expected to be
required as part of pilot-school onboarding - not enforced by a DB
constraint, since it can't be known at the point existing schools were
created). `lib/agents/safeguarding/notify.ts` notifies the union of
ADMIN-role users at the school (the "principal" proxy, since no PRINCIPAL
Role exists) and this field, deduplicated.

**Delivery channel (Gate D, implemented):** both `createInboxNotification`
and `sendPushToUser` (`lib/notifications/inboxService.ts`,
`lib/push/sendPush.ts`), no new channel built. Push failures are logged and
swallowed (the inbox notification is the durable record; push is
best-effort speed).

## What does the agent tell the guardian while escalating?
**Implemented (Gate B, done).** For the keyword-gate path (the common
case), the message is fixed and guaranteed-correct, not LLM-composed:
"I hear you, and this is serious. I've alerted the school right away. If
your child is in immediate danger, please call the police at 0770-800-911.
For more help, Liberia's child protection hotline is 116."
(`lib/agents/safeguarding/resources.ts`). Both numbers are real and cited:
116 via the MOGCSP official press release (see Research Plan below);
0770-800-911 via an official LNP public safety notice (2026-07-14) - and
explicitly not 911, which is not in use in Liberia. For the LLM-judgment
path (`safeguarding.escalate` called by the agent's own reasoning), the
system prompt embeds the same script so the agent's composed response uses
the real numbers too, with lower formatting guarantees than the
deterministic path.

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

## Legal considerations: mandatory reporting in Liberia - RESEARCH PLAN
This is blocking item 3, and per the review, "the most important open
question for the sprint." What follows is a plan for getting a real answer,
not an answer - no legal conclusion is drawn here, and none should be until
a qualified person weighs in.

### Grounding (public-web research, 2026-07-13 - context for the plan, not a legal answer)
- **Children's Law of Liberia (2011)** exists and is real: "An Act to
  Establish the Children's Law of Liberia, 2011," passed by the Senate
  2011-09-15, signed/launched 2012-02-04. Full text mirrored at
  [Better Care Network](https://bettercarenetwork.org/sites/default/files/An%20Act%20to%20Establish%20the%20Children's%20Law%20of%20Liberia%202011.pdf)
  and [FAOLEX](https://www.fao.org/faolex/results/details/en/c/LEX-FAOC199328/).
  A secondary source (an ACERWC Liberia state report, not the primary
  statute) paraphrases it as introducing mandatory-reporting provisions
  covering "parents, caregivers, teachers, guardians, nurses or any other
  service providers" - **this paraphrase was not verified against the
  primary legal text**, and whether "service provider" extends to a digital
  platform like LiberiaLearn is exactly the open question. The primary
  statute's actual article and scope need to be read directly, by someone
  qualified to interpret it, not summarized further by an LLM.
- **Ministry of Gender, Children and Social Protection (MOGCSP)** is the
  correct current ministry name, confirmed via their official site
  ([mogcsp.gov.lr](https://mogcsp.gov.lr/)). They operate a **116 hotline**
  (toll-free, trained social workers, referral to law enforcement/health/
  social services), launched 2024-12-18 per an
  [official ministry press release](https://mogcsp.gov.lr/gender-ministry-unveils-national-gbv-116-call-center-with-support-from-world-bank/).
  24/7 operation was not explicitly confirmed in that source. Also listed on
  the aggregator [findahelpline.com](https://findahelpline.com/organizations/116-service-line-ministry-of-gender-children-social-protection).
  Liberia's dedicated child helpline is separately branded **"My Voice, My
  Safety"** per [Child Helpline International's](https://childhelplineinternational.org/helplines/)
  network directory (medium confidence - directory source, not
  cross-verified against a Liberia-side page). **Neither the 116 number nor
  "My Voice, My Safety" should be used as the emergency-contact script's
  number until independently confirmed current** (blocking item 2) - this
  research surfaced candidates, it did not verify them for production use.
- **No source found addressing digital/telecom/ed-tech platform obligations
  specifically**, as distinct from schools or individual professionals. This
  gap looks real (not a search failure) - it's the crux of what a lawyer or
  MOGCSP contact needs to close.

### Who to consult, in order
1. **MOGCSP directly** - the primary government authority; first-choice
   consult given they administer the Children's Law's protection structure
   and the 116 hotline. Contact page:
   [mogcsp.gov.lr/contact](https://mogcsp.gov.lr/contact/). Likely reachable
   via the existing MOE relationship this platform already has, rather than
   cold outreach.
2. **A Liberian lawyer or legal-aid organization** with child-protection/NGO
   regulatory experience, specifically to read the Children's Law's
   mandatory-reporting article and give a written opinion on whether it
   extends to a platform operator like LiberiaLearn, and any additional
   obligations (data handling, reporting timelines, form of report).
3. **UNICEF Liberia**, [Child Protection program](https://www.unicef.org/liberia/child-protection) -
   active in Liberia's child-protection system-building; no direct
   legal-advice channel found, but a plausible facilitator to the right
   government contact if MOGCSP is slow to respond.
4. **Save the Children Liberia** - Monrovia HQ, +231 886 962 190,
   Liberia.Office@savethechildren.org (official
   [country office contact page](https://liberia.savethechildren.net/contact-us)),
   has a Child Protection thematic program; a second-opinion consult if
   government guidance is unclear or slow.

### What to ask
1. Does the Children's Law of Liberia's mandatory-reporting obligation apply
   to a digital platform that receives a safeguarding disclosure via SMS
   from a guardian (not the child directly, not an employee)?
2. If yes: what is the required reporting channel, timeline, and form? Does
   reporting to MOGCSP's 116 hotline satisfy it, or is a separate filing
   required?
3. Does LiberiaLearn need a written child-protection policy on file with any
   authority before operating this feature?
4. Are there data-handling obligations specific to a safeguarding disclosure
   (retention, who may access the `EscalationQueue` entry, whether it can be
   shared with MOGCSP/police without further guardian consent)?
5. Confirm the 116 hotline and "My Voice, My Safety" helpline (or whatever
   number this consultation surfaces) as the correct, current
   guardian-facing emergency contact for the acknowledgment script.

**Do not flip `AGENT_GUARDIAN_ENABLED` to true in production, and do not
implement the notification/keyword-gate/SLA mechanisms in this spec, until
this plan has been run and items 1-5 above are resolved.**
