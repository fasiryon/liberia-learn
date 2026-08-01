# LiberiaLearn — National Rollout Execution Plan

This plan governs the path from **current production baseline** to **world-class national rollout** (all Liberia, no controlled pilot). Execute one sprint at a time unless a section explicitly allows parallel work within the same phase.

**Companion docs:**
- `docs/roadmaps/CURRENT_EXECUTION_STATE.md` — live status (update after each sprint)
- `docs/roadmaps/IMPLEMENT.md` — agent runbook
- `docs/LOAD_TEST_RESULTS.md` — baseline load evidence
- `docs/PHASE5_2_CURRICULUM_AUDIT_REPORT.md` — content coverage baseline
- `docs/ops/SCALE_READINESS.md` — architecture limits

**National sign-off criteria (all must pass before public national launch):**
1. k6 production load: 1,000+ unique students, p95 &lt; 2s, error rate &lt; 1%
2. k6 school-day spike: 5,000 concurrent (outside school hours first)
3. Curriculum: Grades 1–12 × core subjects ≥ 15 APPROVED lessons each (ENGLISH where applicable)
4. Security: middleware on all portals, tenant guard on APIs, Upstash mandatory in prod
5. Ops: on-call rotation, unified monitoring, Playwright on main deploy, quarterly rollback drill
6. MOE: refreshed production certification + signed coverage matrix

---

## Sprint index

| Sprint | Name | Phase | Workstream | Status | Gate |
|--------|------|-------|------------|--------|------|
| NR-0 | Program Baseline + Doc Sync | 0 | All | COMPLETE | PASS |
| NR-1 | Production Infra Upgrade | 0 | Scale | COMPLETE | PASS |
| NR-2 | ECS Worker Autoscale + Queue SLOs | 0 | Scale | COMPLETE | PASS (verified live against AWS 2026-07-28: ECS service active 1/1, autoscaling min1/max10 target-tracking on SQS depth=50, both queues present) |
| NR-9.5 | Child Safety Hardening (Safeguarding Alerting + AI Moderation Audit) | 2 (executed early) | Security | COMPLETE | PASS (2026-07-30, commits f8c9529b..72e5c8c6, merged via PR #62) |
| NR-9.6 | Grading Surface Moderation Audit | 2 (executed early) | Security | COMPLETE | PASS (2026-07-30) |
| NR-3 | Load-Test Identity Pool | 0 | Scale | COMPLETE | PASS (2026-07-31, prisma generate/tsc/vitest 4441 tests-541 files/build all PASS, real production dry-run evidence in `docs/LOAD_TEST_RESULTS.md`) |
| NR-4 | k6 Moderate (1K VU) Production Proof | 1 | Scale | FAIL / BLOCKED (budget) | FAIL x2 (2026-07-31). Run 1: p95 19.97s vs <2000ms target. Run 2 (after `MAX_CONCURRENT_DB_FALLBACKS` re-tune + pre-warm broadening, PR #68): aborted by the new kill-switch (PR #67) during pre-warm itself, p95 15.2s sustained 60s, never reached the timed scenario. Sustained-duration degradation mechanism not yet understood; see `docs/LOAD_TEST_RESULTS.md`. Leading root-cause candidate is Supabase free-tier compute/pooler limits (confirmed 2026-08-01, org "Farquema" is not on Pro). **2026-08-01: explicitly deferred, not abandoned** — user does not currently have budget for the Supabase Pro upgrade. Re-attempt once funded. |
| NR-5 | k6 Peak (5K VU) + AI Burst Gate | 1 | Scale | PENDING (blocked on NR-4) | NOT RUN. Still cannot start until NR-4 genuinely passes, per this plan's own parallel-work rule ("NR-5 before NR-4" = not allowed). Unaffected by the NR-4 budget deferral below. |
| NR-6 | Middleware Portal Hardening | 2 | Security | COMPLETE | PASS (2026-08-01, PR #70, merge commit `4eb18d44`). Started out of sequence ahead of NR-4/NR-5 as a documented, user-approved budget-driven reorder. Audited all 226 routes under `app/api/admin/`/`app/api/platform/`; found zero unprotected routes. Added an authentication-only middleware backstop for those two API prefixes (deliberately not role-gated, since some routes legitimately allow non-ADMIN roles via record-scoped service-layer checks). Gate: prisma generate/tsc/vitest 4446 tests-541 files (baseline 4441/541, +5 new)/build all PASS, CI green, zero schema changes. Live post-merge walkthrough against production as `teacher1@liberialearn.dev` (real TEACHER session, bcrypt-verified): `/api/admin/agents` → 403, `/api/platform/stats` → 403 "platform admin required", `/admin` page → redirect to `/unauthorized` (control group, unchanged). Unauthenticated: `/admin`/`/platform` → 307 to `/login`, `/api/admin/agents`/`/api/platform/stats` → 401. Found, and logged to `CONSOLIDATED_BACKLOG.md`, that Vercel Preview deployments are missing Upstash Redis env vars, blocking pre-merge authenticated walkthroughs platform-wide (not specific to this PR). |
| NR-7 | Systematic Tenant Access Guard | 2 | Security | PENDING | NOT RUN |
| NR-8 | RBAC Expansion + SSO Onboarding Fix | 2 | Security | PENDING | NOT RUN |
| NR-9 | Audit Immutability + Pen Test Remediation | 2 | Security | PENDING | NOT RUN |
| NR-10 | Student Fail-Closed Curriculum Routing | 3 | Content | PENDING | NOT RUN |
| NR-11 | MOE Published Backlog Approval Sprint | 3 | Content | PENDING | NOT RUN |
| NR-12 | Critical Grade Deserts (G2, G9) | 3 | Content | PENDING | NOT RUN |
| NR-13 | Grades 5–8 Gap Closure + ENGLISH | 3 | Content | PENDING | NOT RUN |
| NR-14 | National Audio Pipeline Completion | 3 | Content | PENDING | NOT RUN |
| NR-14.5 | Auto-Grading Fairness Review | 3 | Content | PENDING | NOT RUN |
| NR-15 | Unified Ops Dashboard + Alerting | 4 | Ops | PENDING | NOT RUN |
| NR-16 | Playwright CI + Phase 6 Close on Main | 4 | Ops | PENDING | NOT RUN |
| NR-17 | DR Drill + Export Circuit Breaker Under Load | 4 | Ops | PENDING | NOT RUN |
| NR-17.5 | Data Retention Enforcement + Minors Legal Mapping | 4 | Ops/MOE | PENDING | NOT RUN |
| NR-18 | MOE Coverage Dashboard + Certification Refresh | 5 | MOE | PENDING | NOT RUN |
| NR-18.5 | Governed Export Completeness | 5 | MOE | PENDING | NOT RUN |
| NR-19 | County Seed + Bulk School Onboarding | 5 | GTM | PENDING | NOT RUN |
| NR-20 | National Support + Training Package | 5 | GTM | PENDING | NOT RUN |
| NR-21 | National Launch Sign-Off Gate | 6 | All | PENDING | NOT RUN |

---

## How execution works

1. Read `AGENTS.md`, this file, and `docs/roadmaps/CURRENT_EXECUTION_STATE.md` before touching code.
2. Execute only the first sprint marked `PENDING` **in the Sprint index table's actual row order**, unless explicitly instructed otherwise. Row order is not always numeric order: **NR-9.5 was deliberately reordered ahead of NR-3 on 2026-07-30**, and **NR-9.6 was added and reordered the same way immediately after**, both by explicit user decision — child-safety readiness (safeguarding alerting, AI moderation across the tutor/lab/grading surfaces, on the exact population this project exists to protect) is a different category of risk than scale/load readiness, and this project has precedent for handling real safety findings with immediate urgency rather than queuing them behind whatever was already in flight (Sprint 6.1 safeguarding work, tenant-scoping fixes). NR-9.6 exists at all because NR-9.5's own full-codebase moderation sweep found a second real gap outside its original scope and the user chose a clean follow-up sprint over appending a rushed sixth deliverable. Do not "fix" the table back into strict numeric order without checking with the user first — the numbering gaps are intentional.
3. **Feature work runs as a separate, parallel track, not a strict prerequisite.** The original "no new product features until NR-5" freeze was never actually followed (Sprint 6.0 through 7.5's entire agent platform, AI Labs V1, and the Teaching Runtime v1 sprint all shipped or were approved while NR-2 through NR-5 sat PENDING) and is corrected here rather than left contradicting reality (2026-07-28). NR sprints and product/agent-platform sprints (tracked separately, see `docs/roadmaps/CURRENT_EXECUTION_STATE.md`) may proceed concurrently. The one thing that still genuinely blocks on NR-5: do not announce or execute the national public launch (NR-21) before peak load is proven.
4. Run the sprint gate exactly as written. All steps must pass before the next sprint.
5. After a passed gate: commit, push, confirm CI green, update this table and `CURRENT_EXECUTION_STATE.md`, stop.
6. Load tests (NR-4, NR-5, NR-17): run **outside** Liberian school hours (before 07:30 GMT or after 15:30 GMT) per `docs/DEPLOYMENT_DISCIPLINE.md`.
7. Deploy discipline: clean working tree, 4 CI workflows green, no `--force` deploy from dirty tree.

### Standard code gate (every sprint unless overridden)

1. `npx prisma generate`
2. `npx tsc --noEmit`
3. `npx vitest run` (or `npm test`)
4. `npm run build`

### Standard commit message

```
feat: NR-[N] complete — [sprint name]
```

---

## Phase 0 — Infrastructure foundation (Weeks 1–2)

### NR-0 — Program Baseline + Doc Sync

- **Branch:** `feat/nr-0-baseline`
- **Inspect:** `MASTER_EXECUTION_PLAN.md` vs `CURRENT_EXECUTION_STATE.md`; confirm `main` has Phase 5 + Online School sprints; list open branches.
- **Deliverables:**
  - Add `## National Rollout Program` section to `CURRENT_EXECUTION_STATE.md` pointing here
  - Mark completed historical sprints in `MASTER_EXECUTION_PLAN.md` or add deprecation note at top linking to this plan
  - Snapshot: Vercel plan tier, Supabase tier, ECS desired count, Upstash configured Y/N
- **Gate:** Standard code gate + written baseline snapshot in `CURRENT_EXECUTION_STATE.md`

### NR-1 — Production Infra Upgrade

- **Branch:** `feat/nr-1-infra-upgrade`
- **Deliverables:**
  - Vercel **Pro** (or Enterprise) confirmed on production project
  - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set in Vercel prod; deploy fails or warns if missing
  - `DATABASE_URL` pooled (6543, `pgbouncer=true`); `DIRECT_URL` for migrate only
  - Document monthly cost envelope in `docs/ops/SCALE_READINESS.md`
- **Gate:** Standard code gate + `GET /api/health` 200 on production + env checklist signed in state doc

### NR-2 — ECS Worker Autoscale + Queue SLOs

- **Branch:** `feat/nr-2-worker-autoscale`
- **Inspect:** `infra/ecs/`, `worker/index.ts`, `docs/ops/WORKER_DEPLOYMENT.md`, SQS queue depth metrics
- **Deliverables:**
  - Application Auto Scaling on ECS service (min 1, max N on queue depth / message age)
  - CloudWatch alarm or documented manual threshold for queue age &gt; 15 min
  - Synthetic queue flood test: 500 jobs enqueued, drain within SLA (document actual time)
- **Gate:** Standard code gate + flood test evidence in `docs/LOAD_TEST_RESULTS.md` (new section)

### NR-3 — Load-Test Identity Pool

- **Branch:** `feat/nr-3-load-test-pool`
- **Deliverables:**
  - Script: `scripts/seed-load-test-pool.ts` — 1,000+ students across 50+ schools, unique credentials
  - Fix demo student: `Student` row for E2E demo user (quiz/AI load accuracy)
  - k6 scripts use credential pool rotation (no single shared student)
- **Gate:** Standard code gate + script dry-run creates ≥1000 users + `docs/LOAD_TEST_RESULTS.md` pool documented

---

## Phase 1 — Production load proof (Weeks 2–4)

### NR-4 — k6 Moderate (1K VU) Production Proof

- **Branch:** `feat/nr-4-k6-moderate` (scripts + docs; infra from NR-1)
- **Run:** `load-tests/moderate.js` against production with load-test pool, outside school hours
- **Targets:** p95 &lt; 2000ms, error rate &lt; 1%, student today API &gt; 95% success
- **Gate:** Standard code gate + moderate scenario **PASS** recorded in `docs/LOAD_TEST_RESULTS.md`

### NR-5 — k6 Peak (5K VU) + AI Burst Gate

- **Branch:** `feat/nr-5-k6-peak`
- **Run:** `load-tests/peak.js` + dedicated 200-VU AI tutor scenario
- **Targets:** Peak p95 &lt; 5000ms, errors &lt; 5%; AI p95 &lt; 5000ms; budget guard no runaway spend
- **Gate:** Standard code gate + peak + AI **PASS** in load doc + **freeze** on non-essential feature work until NR-21

---

## Phase 2 — Security hardening (Weeks 3–6, may overlap Phase 1 after NR-4)

### NR-6 — Middleware Portal Hardening

- **Branch:** `feat/nr-6-middleware-hardening`
- **Deliverables:**
  - `middleware.ts`: require auth + role for `/admin/*` and `/platform/*` (parity with `/moe/*`)
  - Integration tests for unauthorized redirect/401 on all three portals
- **Gate:** Standard code gate + new middleware tests pass

### NR-7 — Systematic Tenant Access Guard

- **Branch:** `feat/nr-7-tenant-guard`
- **Deliverables:**
  - `lib/tenant/assertSchoolAccess.ts` (or equivalent) — single API for school scope
  - Apply to all `app/api/student/`, `app/api/teacher/`, `app/api/admin/` routes that read/write tenant data
  - Extend `__tests__/growth.tenant-isolation.test.ts` pattern to critical API sample (min 20 routes)
- **Gate:** Standard code gate + tenant isolation tests pass; no regression in existing mastery tenant tests

### NR-8 — RBAC Expansion + SSO Onboarding Fix

- **Branch:** `feat/nr-8-rbac-sso`
- **Deliverables:**
  - `assertPermission` on all governance/export/curriculum override routes (grep audit → fix list)
  - Google SSO: block active session until `schoolId` assigned (invite or school code flow)
  - `MOE_SUPER_ADMIN` added to `SessionUser` type if used in schema
- **Gate:** Standard code gate + `__tests__/permissions.test.ts` / runtime gate pass

### NR-9 — Audit Immutability + Pen Test Remediation

- **Branch:** `feat/nr-9-audit-pentest`
- **Deliverables:**
  - DB triggers or RLS: `AuditLog` append-only at database layer
  - External pen test completed; all CRITICAL/HIGH remediated or accepted with MOE sign-off
- **Gate:** Standard code gate + pen test report linked in `docs/MOE_PRODUCTION_CERTIFICATION.md` (remediation table)

### NR-9.5 — Child Safety Hardening (Safeguarding Alerting + AI Moderation Audit)

> **Execution note (2026-07-30):** despite living here in the Phase 2 write-up
> (its thematic home, and where its ID comes from), this sprint was reordered
> in the Sprint index table to run immediately after NR-2, ahead of NR-3. It
> is the actual next sprint. See "How execution works," step 2.

- **Branch:** `feat/nr-9-5-child-safety`
- **Folded from:** Doc B item B25 (safeguarding alerting is reactive/queryable, not proactive — flagged HIGHER PRIORITY/SAFETY-CRITICAL) and Doc C item C33 (student-facing AI tutor input/output moderation, T1)
- **Deliverables:**
  - Proactive safeguarding alerting: responsible-recipient routing, delivery evidence, retry/failure handling, audit logging, and an operations view showing open/acknowledged/escalated/failed-alert states — do not claim proactive notification until notifications are actually sent, delivered, logged, and visible for review
  - AI tutor input moderation (off-topic / unsafe student prompts) and output safety review for minors, with logging, across `lib/ai/rag/groundedAnswerService.ts` and any other student-facing AI surface
- **Gate:** Standard code gate + a real forced-trigger test proving a safeguarding alert is actually delivered end-to-end (not just logged) + moderation test cases for at least one unsafe input and one unsafe output path

### NR-9.6 — Grading Surface Moderation Audit

> **Execution note (2026-07-30): COMPLETE.** Investigation found:
> `homeworkGrader.ts`/`homework-grader.ts` are NOT accidental duplicates
> (two genuinely separate features, Assignment vs Homework, not
> consolidated). The Homework flow was already safely gated
> (`aiReviewed`); the Assignment flow was not — the 72h auto-release timer
> only governs the *official* score/feedback fields, while the student
> page already showed raw unmoderated `aiFeedback` immediately via an
> unconditional fallback, regardless of the timer. Both
> `AssignmentSubmission` and `GradedSubmission` (essay/AI-literacy) had
> zero real rows in production at investigation time — real, reachable,
> currently-unprotected code, but not yet exercised by a real student.
> Fixed: moderation on all 4 grading functions + the display-gate
> tightening (the more important fix, closes the actual exposure path).
> All verified live against production with real adversarial input.

- **Branch:** `feat/nr-9-6-grading-moderation`
- **Origin:** found during NR-9.5's full-codebase sweep for the same
  "unmoderated bespoke `routedCompletion()` call" pattern that was fixed in
  `groundedAnswerService.ts`, `labAnalyzer.ts`, `planLabAction.ts`, and
  `explainLabState.ts`. Deliberately NOT folded into NR-9.5 — real
  investigation work belongs in its own clean sprint, not appended to an
  already-complete one.
- **Advisor mode. Investigate and report before implementing**, same
  discipline as NR-9.5:
  1. `lib/ai/homeworkGrader.ts` (`gradeHomework`) and `lib/ai/homework-grader.ts`
     (`HomeworkGrader` class) are both live, parallel implementations —
     confirmed the latter is called from `lib/ai/rubric-generator.ts`'s
     `gradeSubmissionWithRubric` fallback path. Before touching either:
     confirm which is actually primary in production (real call-site/usage
     audit, same method as NR-9.5's AIInteraction volume check), which is a
     fallback, and whether the duplication is intentional or accidental —
     same category of question as the earlier tutor-path consolidation
     ([[project_tutor_architecture_consolidation_queue]]).
  2. Confirm the real current behavior of Sprint 20's 72-hour
     teacher-approval auto-release: does an un-reviewed auto-release let
     **raw, unmoderated AI-generated feedback text** reach the student
     directly, or does the auto-release only affect the grade/score
     becoming visible while feedback text follows some other path? This
     distinction determines real urgency and must be established from real
     code/data, not assumed.
  3. `lib/grading/gradeEssay.ts` and `lib/grading/gradeAILiteracy.ts` — same
     audit: do they take real student-authored free text as input, does
     their output reach the student without review, real usage volume.
- **Escalation points (stop, do not implement without review):**
  1. Whether to fix `homeworkGrader.ts` and `homework-grader.ts` both, or
     consolidate/deprecate one, once the primary-vs-fallback investigation
     above reports back — a real product/architecture decision, not purely
     technical.
  2. If the 72h auto-release investigation finds raw unmoderated text
     genuinely reaches students, whether the auto-release *policy* itself
     (not just moderation) needs a change — a real product decision on
     grading turnaround vs. safety tradeoff.
  3. Any schema change touching a production-live table.
  4. Alert/escalation channel and recipient logic for anything this sprint
     finds and needs to escalate — reuse existing infrastructure
     (`enqueueEscalation`, `notifySchoolSafeguarding`/platform fallback from
     NR-9.5), do not build a new channel.
- **Deliverable:** if the audit confirms a real gap, apply the same
  `moderateText()` input-block / output-block-and-escalate pattern used
  throughout NR-9.5 to `gradeEssay.ts` and `gradeAILiteracy.ts` (and
  whichever of the two homework-grader implementations the investigation
  confirms is live), reusing infrastructure throughout.
- **Gate:** Standard code gate + real walkthrough verified against a real
  adversarial input in production, the same way NR-9.5 verified its own
  fixes (not passing tests alone).

---

## Phase 3 — National curriculum (Weeks 4–10)

**Coverage rule:** ≥ 15 `APPROVED` lessons per grade × subject (from `docs/PHASE5_2_CURRICULUM_AUDIT_REPORT.md`).

### NR-10 — Student Fail-Closed Curriculum Routing

- **Branch:** `feat/nr-10-curriculum-routing`
- **Deliverables:**
  - `/api/student/today`, adaptive plan, lesson catalog: only `APPROVED` content
  - Admin/MOE coverage API: grade × subject counts
- **Gate:** Standard code gate + tests: unapproved content never returned to student role

### NR-11 — MOE Published Backlog Approval Sprint

- **Branch:** `feat/nr-11-approve-backlog` (ops + content; may be MOE-led with engineering support)
- **Target:** Clear **389 published** lessons (priority G5, G7 per audit)
- **Deliverables:**
  - Bulk approve workflow or scripted MOE approval with audit trail
  - Post-approval: coverage dashboard shows G5/G7 green
- **Gate:** Standard code gate + DB query evidence: published backlog &lt; 50 remaining

### NR-12 — Critical Grade Deserts (G2, G9)

- **Branch:** `feat/nr-12-grade-deserts`
- **Deliverables:**
  - Regen + QA for Grade 2 and Grade 9 until ≥15 APPROVED per core subject
  - Factory tuning for known low pass rates (G3 SCIENCE, G5 ENGLISH, G7 CIVICS) documented
- **Gate:** Standard code gate + coverage matrix row for G2 and G9 all green

### NR-13 — Grades 5–8 Gap Closure + ENGLISH

- **Branch:** `feat/nr-13-grades-5-8`
- **Target:** G5–G8 ≥15 APPROVED per subject; ENGLISH &gt; 0 nationally; SOCIAL_STUDIES 5–9 filled
- **Gate:** Standard code gate + full G5–G8 matrix green on coverage dashboard

### NR-14 — National Audio Pipeline Completion

- **Branch:** `feat/nr-14-national-audio`
- **Inspect:** `docs/roadmaps/national-curriculum-pipeline/EXECUTION.md`
- **Deliverables:**
  - All APPROVED lessons: `LessonAudio` GENERATED or explicit `audioOptOut` flag
  - Worker/autoscale from NR-2 proven under audio batch load
- **Gate:** Standard code gate + audit script: &lt; 1% APPROVED lessons missing audio without opt-out

### NR-14.5 — Auto-Grading Fairness Review

- **Branch:** `feat/nr-14-5-grading-fairness`
- **Folded from:** Doc C item C35 (auto-grading fairness review — essay/code/AI-literacy, T2)
- **Deliverables:**
  - Bias audit of WAEC-rubric essay grading, Judge0 code grading, and AI-literacy grading (all advisory per NR-14B/C/D)
  - Confirm teacher-override is always available and discoverable on every auto-graded item before national high-stakes use
- **Gate:** Standard code gate + documented fairness audit findings + remediation for any confirmed bias

---

## Phase 4 — Reliability & operations (Weeks 6–10)

### NR-15 — Unified Ops Dashboard + Alerting

- **Branch:** `feat/nr-15-ops-dashboard`
- **Deliverables:**
  - Single operator view: error rate, queue depth, DB pool hint, AI spend 24h, active schools, curriculum gaps
  - Alerts: Sentry → Slack/PagerDuty; uptime on `/api/health`; queue age &gt; 15 min
  - On-call roster doc: `docs/ops/ON_CALL.md`
- **Gate:** Standard code gate + tabletop incident drill (documented)

### NR-16 — Playwright CI + Phase 6 Close on Main

- **Branch:** `feat/nr-16-ci-playwright`
- **Deliverables:**
  - GitHub Actions: Playwright smoke on `main` deploy (or nightly against production URL)
  - Merge `feat/phase-5-intelligence-system` (or equivalent) — Phase 6 gate complete
  - `npx playwright test` PASS on production URL
- **Gate:** Full gate + Playwright CI green + Phase 6 marked COMPLETE in state doc

### NR-17 — DR Drill + Export Circuit Breaker Under Load

- **Branch:** `feat/nr-17-dr-exports`
- **Deliverables:**
  - Quarterly rollback drill executed; notes in `docs/ops/DR_DRILL_LOG.md`
  - MOE export under 500 concurrent users: no API starvation (queue or circuit breaker)
  - `ENABLE_GOV_CIRCUIT_BREAKER` tested
- **Gate:** Standard code gate + DR log entry + load test note for export isolation

### NR-17.5 — Data Retention Enforcement + Minors Legal Mapping

- **Branch:** `feat/nr-17-5-retention-legal`
- **Folded from:** Doc B item B24 (retention policy not enforced by scheduled purge/anonymization) and Doc C item C14 (Liberian data-protection legal mapping, T1)
- **Deliverables:**
  - Scheduled retention workflow: identify eligible records by data class per the published active-account-lifetime-plus-2-years policy, purge or anonymize, preserve required audit/safeguarding/school-record exceptions, write audit evidence for every action — production-safe dry-run reporting before any destructive execution
  - Explicit mapping of `docs/PRIVACY_GOVERNANCE.md` to Liberian legal requirements for minors' data (legal review; calendar time, not just engineering)
- **Gate:** Standard code gate + dry-run report reviewed before enabling destructive execution + legal mapping doc signed off

---

## Phase 5 — MOE trust & national GTM (Weeks 8–12)

### NR-18 — MOE Coverage Dashboard + Certification Refresh

- **Branch:** `feat/nr-18-moe-certification`
- **Deliverables:**
  - MOE portal: national coverage heatmap (grade × subject × county)
  - Refresh `docs/MOE_PRODUCTION_CERTIFICATION.md` with k6 NR-4/NR-5 results (not synthetic-only claims)
  - MOE signed coverage matrix PDF referenced in repo
- **Gate:** Standard code gate + certification doc dated + MOE sign-off recorded

### NR-18.5 — Governed Export Completeness

- **Branch:** `feat/nr-18-5-export-completeness`
- **Folded from:** Doc B item B26 (governed export job generation incomplete for some listed types, e.g. `intervention_effectiveness`, `ai_usage`)
- **Deliverables:**
  - Inventory every `ExportJobRequest.exportType`; identify which have real generation and storage paths
  - Implement missing generation paths or remove unavailable types from request options
  - Round-trip test for each supported export type
- **Gate:** Standard code gate + round-trip test evidence for every listed export type

### NR-19 — County Seed + Bulk School Onboarding

- **Branch:** `feat/nr-19-county-onboarding`
- **Deliverables:**
  - Seed or import path for all **15 counties** (not demo-only Montserrado)
  - Bulk import tested: 500 students/school CSV under 5 min
  - School self-registration fraud controls documented
- **Gate:** Standard code gate + import integration test + 3 non-demo schools onboarded in staging

### NR-20 — National Support + Training Package

- **Branch:** `feat/nr-20-national-training`
- **Deliverables:**
  - Principal/admin/teacher training decks + videos (English; Kpelle/Bassa where available)
  - Helpdesk: phone/WhatsApp + ticket SLA documented
  - `ENABLE_LIVE_SMS=true` production checklist (Africa's Talking / Twilio Liberia)
  - District platform dashboard: replace placeholder in `app/platform/page.tsx`
- **Gate:** Standard code gate + training URLs in `docs/rollout/NATIONAL_TRAINING.md` + district portal live

---

## Phase 6 — National launch (Week 12–14)

### NR-21 — National Launch Sign-Off Gate

- **Branch:** `release/national-v1.0.0`
- **Checklist (all required):**

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | k6 1K VU PASS | `docs/LOAD_TEST_RESULTS.md` |
| 2 | k6 5K VU PASS | `docs/LOAD_TEST_RESULTS.md` |
| 3 | Curriculum matrix 100% | MOE coverage dashboard + signed matrix |
| 4 | NR-6–NR-9 security complete | Tests + pen test report |
| 5 | Upstash mandatory prod | Env policy + deploy check |
| 6 | Worker autoscale proven | NR-2 flood test |
| 7 | Playwright CI green | GitHub Actions |
| 8 | On-call + DR drill | `docs/ops/ON_CALL.md`, `DR_DRILL_LOG.md` |
| 9 | MOE certification refreshed | `docs/MOE_PRODUCTION_CERTIFICATION.md` |
| 10 | 4 CI workflows green on release commit | GitHub |
| 11 | Vercel production deploy outside school hours | Deploy log |
| 12 | No P0/P1 open security findings | Pen test tracker |

- **Gate:** All 12 checklist items ✅ + tag `national-v1.0.0` + public announcement only after MOE written approval

---

## Parallel work rules

| Allowed parallel | Not allowed |
|------------------|-------------|
| NR-1 + NR-0 | NR-5 before NR-4 |
| NR-6 + NR-10 (different files) | New labs/features during Phase 1 |
| NR-11 (MOE ops) + NR-15 | NR-21 before NR-4 and NR-13 |
| NR-18 + NR-14 after NR-10 | Skip pen test (NR-9) |
| NR-6 while NR-4 is budget-blocked (2026-08-01, user-directed exception — see `CURRENT_EXECUTION_STATE.md`) | NR-21 still requires NR-4/NR-5 PASS regardless of this exception |

---

## Workstream summary

| Workstream | Sprints | Outcome |
|------------|---------|---------|
| **Scale** | NR-1 – NR-5 | Proven 1K–5K VU on production |
| **Security** | NR-6 – NR-9 | Defense in depth + pen test clean |
| **Content** | NR-10 – NR-14 | Full national curriculum + audio |
| **Ops** | NR-15 – NR-17 | SLOs, CI, DR, exports safe under load |
| **MOE & GTM** | NR-18 – NR-20 | Counties, training, support, certification |
| **Launch** | NR-21 | Tagged national release |

---

## Timeline estimate

| Phase | Calendar | Sprints |
|-------|----------|---------|
| 0 — Infra | Weeks 1–2 | NR-0 – NR-3 |
| 1 — Load proof | Weeks 2–4 | NR-4 – NR-5 |
| 2 — Security | Weeks 3–6 | NR-6 – NR-9 |
| 3 — Curriculum | Weeks 4–10 | NR-10 – NR-14 |
| 4 — Ops | Weeks 6–10 | NR-15 – NR-17 |
| 5 — MOE/GTM | Weeks 8–12 | NR-18 – NR-20 |
| 6 — Launch | Weeks 12–14 | NR-21 |

**Total: ~12–14 weeks** with dedicated engineering + MOE reviewer capacity. Curriculum (NR-11–NR-14) is the longest pole.

---

## Non-negotiable spend

| Item | Purpose |
|------|---------|
| Vercel Pro+ | API concurrency |
| Supabase scale + pooler | DB headroom |
| Upstash | Distributed rate limits |
| ECS autoscale | Background jobs |
| Pen test vendor | MOE trust |
| MOE reviewer time | Approve 389+ lessons |
| On-call (2+ people) | School-hours incidents |

---

## What NOT to do during this program

- Do not treat synthetic `nationalScaleSmoke.test.ts` as production load proof
- Do not announce national launch before NR-21 checklist complete
- Do not announce or execute the national public launch (NR-21) before NR-5 peak load proof passes (feature work itself is not gated on this, see "How execution works" above)
- Do not run k6 peak during Liberian school hours
- Do not weaken RBAC, tenant isolation, or audit logging to pass a gate
