# Guardian Safeguarding Escalation Integration (Sprint 6.1, escalation point 5)

STATUS: **NOT APPROVED (2026-07-13).** Implementation stays blocked on the 5
items below. Nothing in this spec was built or changed this round beyond the
research plan at the bottom. `safeguarding.escalate` (Deliverable 3) still
only writes an `EscalationQueue` row - it does not notify anyone, has no
keyword safety net, and no SLA-breach handling.

## Blocking items (recorded verbatim from the review, do not implement past these)
1. Confirm a designated safety-staff field in the `School` model (or add
   one) - i.e. resolve the "who is (b)" question below with a real schema
   answer, not the pilot-scale workaround (c) this doc originally proposed.
2. Get the actual Liberia emergency number and the Liberia child-protection
   hotline. **Do not use placeholders in production** - the guardian-facing
   acknowledgment script (below) stays unshipped until these are real.
3. Legal counsel on Liberian mandatory-reporting obligations - a real legal
   question needing a real answer, not an LLM summary. See Research Plan.
4. Define what happens when the SLA is missed: auto-escalate to district,
   notify a specific person, or just log? Not decided.
5. Add an explicit "err on the side of escalation" rule: false positives are
   acceptable, false negatives are not. This changes the recommendation
   below from "keyword net as a floor under LLM judgment" to a firmer
   default - noted, not yet encoded, since the mechanism it would live in
   (the keyword gate) isn't built until this spec is approved.

Everything else in this document is proposal/analysis, unchanged from the
draft reviewed, kept for context on what implementation will need to do once
items 1-5 are resolved.

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

**Superseded by blocking item 1 above**: the reviewer wants a real
designated-safety-staff field on `School` (closer to option (b)) rather than
the pilot-workaround (c). Not designed further here - needs product input on
whether it's a single `designatedSafetyStaffUserId` (one person per school)
or a small list, and whether it's admin-settable per school or seeded at
onboarding.

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
