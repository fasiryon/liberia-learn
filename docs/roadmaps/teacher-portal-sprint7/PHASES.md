# Sprint 7 — Teacher Portal Sub-Sprint Plan

Produced as Phase D of the Combined Roadmap (Training/Support, Enterprise
Readiness, Interoperability, Teacher Portal), July 2026. This document is
the actual Phase D deliverable: a real, immediately-dispatchable sub-sprint
breakdown, written to the same rigor as every 6.x dispatch this session.
It is a plan, not code. Each sub-sprint below can be handed to a future
session as-is, with zero additional scoping work.

Standing context inherited by every sub-sprint below:
`docs/agents/ADVISOR_ESCALATION_CONTRACT.md`. Carry-forward rules apply
throughout: contentId in URLs not sw.id, hero content in payload.body,
DIRECT_URL/5432 for batches of 25 rows or fewer vs pooler/6543 for reads,
`.trim()` on all Vercel env vars, feature flags routed through
`isFlagEnabled()` from `lib/serverFlags.ts`, no em dashes in any output or
committed file, `requireUser()` from `lib/auth` never `getServerSession()`,
all LLM calls through `routedCompletion()`.

## Honest scope finding (read before dispatching 7.2)

Investigation for this plan confirmed that Sprint 6.7 ("Adaptive
/student/today", commit `d041ad2`) already built and shipped the hard part
of a differentiation engine: `lib/student/nextBestAction.ts` is a pure,
unit-tested, deterministic next-best-action ranking function, consumed by
`app/api/student/today/route.ts`. It is not wired into any teacher-facing
surface today (no import under `app/teacher/`) and it only ever ranks
actions for one student at a time; there is no class-wide rollup query.
This is genuine good news: 7.2 below is scoped as a rollup-and-UI sub-sprint
that reuses the existing scoring function, not a sub-sprint that has to
invent new ranking logic. Report this plainly rather than treating it as
grounds to inflate 7.2's scope.

Similarly, Sprint 6.0's agent platform (`AgentGoal`, `AgentInvocation`,
`AgentCostAccounting`, `AgentControl`, `EscalationQueue` in
`prisma/schema.prisma`, plus `lib/agents/scheduler.ts` and
`lib/agents/triggers.ts`) already provides everything a new scheduled
agent needs. 7.4 below is scoped as "add one more agent in the existing
pattern," matching content-qa, ops-sentinel, and moe-narrative-report,
not a new agent-platform build.

No prior Sprint 7 / teacher-portal / trust-privacy-framework scoping
document exists anywhere in this repository. The only file match for
"Sprint 7" is an older, already-shipped, unrelated governance/exports
sprint in `docs/roadmaps/MASTER_EXECUTION_PLAN.md` — a name collision,
not applicable here. Everything below is written from scratch.

═══════════════════════════════════════════════════════════════════
7.1 — MOE Curriculum Standards Browser (teacher-facing, general subjects)
═══════════════════════════════════════════════════════════════════

CONTEXT — investigate first: the existing WAEC-specific standards work
(`lib/waec/syllabus.ts`, `lib/waec/readiness.ts`,
`lib/mastery/resolveStrand.ts`, migration
`20260702_000001_waec_syllabus_topics`, `docs/curriculum/WAEC_SYLLABUS_MAP.md`,
and the `/student/waec/*` routes) as the closest existing precedent for a
standards data model. Also re-check `alignContentToMOE` and the
7.9%-coverage one-time batch noted in project memory
(`moe_alignment_lifecycle_wiring_queue`) — this sub-sprint is additive to
that gap, not a replacement for it; do not re-scope that separate queued
item into this one.

GOALS — build to full completion:
1. A general (non-WAEC-only) MOE curriculum-standards data model covering
   every subject/grade band the platform teaches, distinct from the
   WAEC exam-syllabus model (WAEC stays as-is; this is the broader
   teaching-standards layer a non-exam-year teacher also needs).
2. A teacher-facing standards browser page (`/teacher/standards` or
   equivalent) — real content per subject and grade, searchable or at
   minimum well organized by subject/grade/strand, showing which lessons
   in the platform's existing content already map to each standard (reuse
   `alignContentToMOE` output where it exists; show "not yet aligned"
   honestly where it does not, rather than fabricating coverage).
3. A link from each standard to the actual lesson content it maps to, so
   a teacher can go standard to lesson content in one click.

ESCALATION POINTS:
1. Any schema change touching a production-live table (the new standards
   model itself is new/additive and does not require review under the
   standing contract; a change to `CurriculumContent` or `Lesson` tables
   to add back-references would).
2. If the general standards taxonomy would require MOE's own official
   curriculum framework document as a source (i.e., the platform cannot
   honestly claim standards alignment without MOE-provided reference
   material it does not yet have) — stop and report this as a real
   content-sourcing gap, not a data-model gap.

GATE: test count before/after, tsc clean, build green, migration
(additive only, verified live), commit, push, deploy, `/api/health` green,
real production walkthrough as an authenticated teacher account.

═══════════════════════════════════════════════════════════════════
7.2 — Teacher Differentiation Dashboard
═══════════════════════════════════════════════════════════════════

CONTEXT — investigate first: `lib/student/nextBestAction.ts` and
`app/api/student/today/route.ts` (Sprint 6.7) in full, to understand the
exact signals and ranking the existing function already computes per
student. Confirm current teacher-portal navigation and class-roster
data-fetch patterns under `app/teacher/` before adding a new page.

GOALS — build to full completion:
1. A class-wide rollup query that runs the existing
   `lib/student/nextBestAction.ts` scoring across every student in a
   teacher's class (or reuses its underlying signals directly, if calling
   it once per student is not performant at real class sizes — investigate
   and choose, but do not silently change the scoring logic itself).
2. A real teacher-facing differentiation view — which students in this
   class need which kind of intervention right now (behind on WAEC
   readiness, stuck on a specific strand, certificate-eligible but not
   notified, etc.), grouped so a teacher can act on it directly from the
   page (not just a read-only report).
3. Reuse Sprint 6.7's certificate-unlock surfacing logic for the
   class-wide view rather than re-deriving it.

ESCALATION POINTS:
1. Any schema change touching a production-live table.
2. If the per-student scoring function is too slow to run class-wide in a
   single request (real class sizes can run 40-60 students) — this is a
   genuine performance/architecture judgment call (batch job vs. inline
   compute vs. cached nightly rollup) with no single obviously-correct
   answer; stop and report the measured latency plus the tradeoffs before
   choosing.

GATE: same standard as 7.1, plus a real production walkthrough with a
teacher account that has an actual multi-student class, verifying the
rollup reflects real per-student state.

═══════════════════════════════════════════════════════════════════
7.3 — Teaching Skills Library
═══════════════════════════════════════════════════════════════════

CONTEXT — investigate first: confirm (as this plan's own research already
did) that no "teaching skills library," "professional development
library," or similar concept exists anywhere in code or docs today — this
is a clean-slate build. Also review the real teacher-training
infrastructure Phase A just shipped (`lib/training/modules.ts`,
`lib/training/completionRecord.ts`, `app/teacher/training/*`) since the
skills library should sit alongside it, not duplicate its completion-
tracking or certificate machinery.

GOALS — build to full completion:
1. A real content library of teaching-practice skills (e.g., differentiated
   instruction techniques, formative-assessment methods, classroom
   management for large under-resourced classrooms, low-bandwidth/offline
   teaching adaptations relevant to LiberiaLearn's actual deployment
   context) — genuine, specific, written content, not placeholder text.
2. Organize it by topic/skill area with a browsing and search surface
   under `/teacher/skills` or equivalent, in the same visual system as the
   rest of the teacher portal.
3. Where a skill genuinely warrants a completion-trackable module (as
   opposed to reference material), route it through the existing
   `lib/training/modules.ts` / `completionRecord.ts` infrastructure rather
   than building parallel tracking.

ESCALATION POINTS:
1. Any schema change touching a production-live table.
2. If any skill-library content would make a claim resembling official
   MOE pedagogical endorsement (the same category of concern Phase A
   flagged for teacher certification wording) — stop and propose careful,
   honest framing before writing that specific content.

GATE: same standard as 7.1.

═══════════════════════════════════════════════════════════════════
7.4 — Morning Brief Agent
═══════════════════════════════════════════════════════════════════

CONTEXT — investigate first: the three already-shipped agents that follow
the platform's standard shape (content-qa, ops-sentinel,
moe-narrative-report) — read one end to end (agent definition, prompt
file, `sweep.ts`, cron wiring) as the template. Confirm
`AgentGoal`/`AgentScheduler`/`AgentTrigger` plumbing in `lib/agents/` needs
no new primitives (this plan's research already confirmed it does not).

GOALS — build to full completion:
1. A new agent definition (`morning-brief` or equivalent) following the
   exact existing pattern: prompt file in the prompt registry, a
   `sweep.ts` that gathers real per-teacher signals (today's classes,
   students flagged by 7.2's differentiation view if 7.2 has shipped by
   the time this runs, overdue grading, upcoming certificate unlocks),
   and a scheduled cron trigger.
2. A real delivery surface: a teacher-facing brief visible on login or a
   dedicated `/teacher/brief` page (start with in-app; do not add a new
   SMS/email channel in this sub-sprint unless investigation shows the
   existing notification infrastructure trivially supports it).
3. Wire cost accounting through the existing `AgentCostAccounting` model
   exactly like the other three agents; do not build a parallel cost
   tracker.
4. Keep the feature flag pattern consistent (`AGENT_MORNING_BRIEF_ENABLED`,
   defaulting false until sign-off, matching every other agent in this
   session).

ESCALATION POINTS:
1. Any schema change touching a production-live table (new agent-platform
   tables are pre-approved for addition per the standing contract).
2. Projected cost per invocation exceeds $0.005 (the standing contract's
   existing threshold) — reconsider model/tool routing before proceeding.

GATE: same standard as 7.1, plus a real triggered sweep against real
production teacher/class data (dry-run first, then live), verified the
same way Sprint 6.3-6.5's agent sweeps were verified.

═══════════════════════════════════════════════════════════════════
7.5 — Trust and Privacy Framework (institutional co-development gate)
═══════════════════════════════════════════════════════════════════

This sub-sprint is explicitly NOT a build-it-yourself sub-sprint. Per the
original Sprint 7 scoping this roadmap inherited, the trust/privacy
framework requires real MOE / NTAL / UNICEF co-development. An AI agent
cannot substitute for actual institutional negotiation over what a trust
and privacy framework commits the platform and its partners to — this is
a genuine, real constraint, not a place scope is being avoided.

What CAN be built now, and should be, ahead of that negotiation:
1. An internal preparation packet: an honest inventory of what
   LiberiaLearn's trust and privacy posture already is in practice today
   (this can draw directly on Phase B's real, verified data-retention
   policy and procurement/security packet from this same roadmap) so the
   institutional conversation starts from an accurate baseline instead of
   from zero.
2. A specific list of open questions this platform cannot answer on its
   own and needs MOE/NTAL/UNICEF input on (example candidates to verify
   and refine at dispatch time, not to treat as final: data-sharing terms
   with the Ministry, guardian-consent framework for a national rollout,
   safeguarding-escalation ownership across institutions, data-residency
   commitments). Do not answer these questions speculatively.

ESCALATION POINTS:
This entire sub-sprint's core deliverable (the actual trust/privacy
framework) is itself the escalation point. When dispatched, the executor
should complete item 1 and 2 above (the honest preparation packet), then
stop and report that the framework itself requires a named human/
institutional decision-maker before it can proceed further. This is the
one sub-sprint in this plan where "stop and hand to a human" is the
expected and correct terminal state, not a fallback.

GATE: for items 1-2 only — real, accurate content verified against actual
current practice (same honesty standard as Phase B), reviewed, committed.
No production deployment gate applies since there is no running code in
this sub-sprint.

═══════════════════════════════════════════════════════════════════
Suggested dispatch order
═══════════════════════════════════════════════════════════════════

7.1 and 7.3 have no dependencies on each other or on anything else in this
list and can be dispatched in either order, or in parallel across two
sessions. 7.2 depends only on 6.7 (already shipped) and can run any time.
7.4 is more useful once 7.2 exists (a differentiation-aware brief is
richer than a bare-schedule brief) but is not blocked by it; dispatching
7.4 before 7.2 is fine if that is the priority. 7.5's preparation-packet
half can start immediately and in parallel with all of the above; its
framework half waits on institutional availability, not on engineering
sequencing.
