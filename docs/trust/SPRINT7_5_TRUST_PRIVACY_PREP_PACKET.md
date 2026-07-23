# Trust and Privacy Framework - Preparation Packet

Prepared: July 23, 2026, as Sprint 7.5 of the Teacher Portal Sub-Sprint Plan.

## What this document is, and is not

This is a preparation packet, not the trust and privacy framework itself.
Per the original scoping this sprint inherited, a real trust and privacy
framework requires actual co-development with the Ministry of Education,
NTAL, and UNICEF. An AI agent cannot substitute for that institutional
negotiation - this document exists so that negotiation starts from an
accurate baseline of what LiberiaLearn's practice actually is today,
rather than from zero, and so that the specific open questions this
platform cannot answer on its own are named plainly instead of answered
speculatively.

Every factual claim below is drawn directly from this roadmap's own
verified Phase B work (`docs/governance/PHASE_B_DATA_RETENTION_POLICY.md`
and `docs/governance/PHASE_B_PROCUREMENT_SECURITY_PACKET.md`, both
already reviewed against real code and current practice) plus direct
inspection of the real consent data model for this packet. Nothing here
overclaims what the platform does; where practice falls short of what a
framework would eventually require, that gap is stated plainly.

## Part 1: Honest inventory of current practice

### Data retention

The public privacy policy states an active-account-lifetime-plus-2-years
retention target. No automated scheduled job enforces that window today.
Current deletion and retention handling is manual and policy-bound.
Audit logs, export records, and data-access logs are retained
indefinitely for accountability and are protected by database
immutability triggers, so they are not subject to the same retention
question as ordinary account data.

### Consent

A real `GuardianConsent` data model exists, but it is narrow: it records
SMS opt-in/opt-out per guardian per student, not a general
platform-usage or data-processing consent. There is no broader
guardian-consent framework covering account creation, data collection
for a minor, or a documented age-appropriate consent flow for a national
rollout. This is a real, current gap, not something already solved that
this packet is merely describing.

### Safeguarding

Safeguarding records and review surfaces exist (Sprint 6.1), and
escalation status can be queried by school staff. Current alerting is
reactive and queryable, not proactive: there is no verified workflow
that actively pushes a timely notification to a responsible reviewer
with delivery evidence. This gap is safety-critical and was already
flagged as a priority in Phase B ahead of ordinary compliance polish.

### Access control and tenant isolation

Role-based access is enforced through authenticated server routes and
permission checks. School admins and teachers are scoped to their own
school context; guardians are scoped to their linked learners; students
are scoped to their own records. This session independently found and
fixed a real tenant-scoping gap in the /admin/agents Escalations panel
(Sprint 6.2), which is evidence the enforcement is real but has had at
least one confirmed lapse, not evidence it is provably complete.

### Data sharing with the Ministry

Authorized MOE exports can include pseudonymized school-cohort learner
rows for oversight review, deliberately excluding names, emails, phone
numbers, guardian contact details, and raw student identifiers. MOE
dashboards are aggregate by default. There is no broader, negotiated data-
sharing agreement beyond what these existing export and dashboard
mechanisms already implement.

### Backups and data residency

Current backups are nightly CSV stopgap exports to private Vercel Blob
storage with 90-day pruning, not a full database backup or verified
point-in-time restore posture. The platform remains on the Supabase free
tier. No data-residency commitment (which country or region the
production database and backups physically reside in, or any contractual
guarantee about that) has been made to any party; this has simply never
been a decision point until an institutional partner asks the question.

### Security posture

Tenant isolation is applicaton-layer, not database-row-level-security-
enforced. Audit logs are append-only. Export and data-access logging
exist for governance review. SSO is explicitly not built, documented as
available once a specific institutional identity provider is named. No
independent penetration test or third-party security audit has been
performed on this platform.

## Part 2: Open questions this platform cannot answer on its own

These are the specific decisions a real trust and privacy framework would
need to settle with MOE, NTAL, and UNICEF input. They are listed as
questions, not proposals - LiberiaLearn's engineering has no standing to
answer them unilaterally, and speculative answers here would misrepresent
institutional commitments nobody has actually made.

1. **Data-sharing terms with the Ministry.** Beyond the existing
   pseudonymized cohort exports and aggregate dashboards, what additional
   data (if any) does MOE require access to, at what granularity, under
   what request/approval process, and with what retention obligation on
   the Ministry's own side once data leaves the platform?

2. **Guardian-consent framework for national rollout.** What does a
   legally sufficient consent process look like for a Liberian family
   enrolling a minor in a platform that collects academic and, in some
   cases, safeguarding-relevant data? Is there an existing Liberian legal
   framework this must align to (a national data-protection law,
   MOE-specific enrollment consent requirements), and does UNICEF have a
   standard child-data-protection consent model this should adopt rather
   than invent independently?

3. **Safeguarding-escalation ownership across institutions.** When the
   platform's safeguarding review surfaces a real concern, who outside
   the school is the responsible escalation path - a district MOE office,
   a national child-protection authority, a UNICEF-affiliated referral
   service - and what is the platform's actual legal and practical
   obligation to notify that party versus the school's own staff?

4. **Data-residency commitments.** Does MOE, NTAL, or Liberian law require
   student data to be hosted within a specific jurisdiction, or is the
   current Supabase/Vercel hosting arrangement (US-region infrastructure)
   acceptable for a national deployment? This has real cost and
   architecture implications if the answer requires migration.

5. **Retention-period ownership.** Is the 2-year-post-account-closure
   retention target in the current public privacy policy actually the
   right number, or was it an engineering-chosen default that should be
   revisited against a real institutional records-retention requirement
   (a school-record law, an MOE data-retention circular, or a UNICEF
   guideline for education-sector child data)?

6. **Breach notification obligations.** If a security incident exposed
   student data, what parties (MOE, guardians, a national authority) must
   be notified, on what timeline, and by whom? No such notification
   process has been defined because no specific legal or institutional
   requirement has been named yet.

7. **Long-term data ownership and portability.** If a school or the
   Ministry ends its relationship with LiberiaLearn, what happens to that
   school's data - deletion, export to another system, indefinite
   retention for historical record purposes? This has not been
   negotiated with any institutional partner.

These seven are the candidates identified during this preparation work;
the actual negotiation may surface additional questions once MOE, NTAL,
and UNICEF stakeholders are in the room, and may resolve some of these as
not applicable. This list is a starting point for that conversation, not
a final agenda.

## Escalation

Per this sub-sprint's own contract, the trust and privacy framework
itself - resolving the seven questions above into an actual agreed
policy - requires a named human/institutional decision-maker and cannot
proceed further within this engineering session. This is the expected
and correct terminal state for this sub-sprint, not a fallback from
running out of scope to build.
