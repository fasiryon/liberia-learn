# LiberiaLearn Consolidated Backlog

**Status:** Canonical project-wide backlog  
**Reconciled:** 2026-08-03  
**Next national sprint:** NR-12, Critical Grade Deserts (G2, G9).
NR-3, NR-6, NR-7, NR-8, NR-10, and NR-11 are all COMPLETE and merged (NR-11
reframed after investigation showed the plan's "389 published" backlog was
resolved by automated scripts, not MOE review — see
`CURRENT_EXECUTION_STATE.md`). NR-4/NR-5 (k6 load proofs) are explicitly deferred on
Supabase Pro budget, not abandoned. NR-9 is PARTIAL: its DB-layer AuditLog
immutability deliverable is done and live-verified in production; its
external-pen-test deliverable is deferred pending a real vendor engagement
(see the NR-9 row below). See `NATIONAL_ROLLOUT_EXECUTION_PLAN.md` and
`CURRENT_EXECUTION_STATE.md` for full detail.

## Authority and maintenance

This file is the canonical inventory of outstanding LiberiaLearn work. It
combines the national rollout sequence, the Phase B pre-pilot findings, the
Phase C national-readiness findings, and actionable work recovered from project
memory.

`NATIONAL_ROLLOUT_EXECUTION_PLAN.md` remains authoritative for the order and
gate of NR sprints. It is not, by itself, the complete project backlog.

When work changes status:

1. Re-verify the claim against live code, data, infrastructure, or provider
   state.
2. Update the corresponding entry here.
3. Update `NATIONAL_ROLLOUT_EXECUTION_PLAN.md` and
   `CURRENT_EXECUTION_STATE.md` when an NR sprint or resume condition changes.
4. Do not delete completed findings. Mark them `DONE / STALE MEMORY` so later
   sessions can distinguish completed work from a lost note.

## Future major program (approved, not started)

**Learner Experience V2 / Interactive Learning Runtime** is an approved
future major program and must not be dropped during P2/P5 execution.
Canonical document: `docs/product/LEARNER_EXPERIENCE_V2_INTERACTIVE_RUNTIME.md`
(captured 2026-08-14, documentation only, no code/schema/production change).
Approved sequence: Phase A (Learner Experience V2 architecture + UX
prototype) runs before Phase B (Curriculum V2) and Phase C (Global Pedagogy
Intelligence), so the curriculum-generation contract is designed against a
known, executable runtime instead of an imagined one; Phase D (Learner
Experience V2 full build), Phase E (Teacher Experience V2), and Phase F
(adaptive mastery/remediation expansion) follow. This program starts only
after P2-B, P2-C, and P5-A close (see `PRIORITIES_1_2_5_6_7_EXECUTION_PROGRAM.md`)
and does not change their sequencing. The canonical document also records a
repository discovery pass showing this is not a green field - the Student
Toolbelt (`components/toolkit/`), a Virtual Lab action/state runtime
(`lib/labs/runtime/`), offline caching/manifest infrastructure, and a
mastery/adaptive foundation already exist and must be extended, not
rebuilt.

## Status definitions

- **VALID:** Current evidence still shows unfinished work.
- **PARTIAL:** Some implementation exists, but the original acceptance criteria
  are not satisfied.
- **POSSIBLY STALE:** Local code or documentation cannot establish the current
  external or production state.
- **DONE / STALE MEMORY:** Implementation exists; the older note was not
  updated.
- **DEFERRED:** Intentionally waits for a prerequisite or product decision.

## National rollout sequence

### P0 security interruption

- **LiberiaLearn Production RLS Exposure Audit and Safe Remediation: VALID,
  P0 (2026-08-11).** Supabase's read-only inventory reported RLS disabled on
  197 production public-schema tables. This is not proof that all tables are
  publicly readable, but requires immediate grant, Data API, access-path, and
  policy discovery before any production change. No RLS mutation is authorized
  in the staging-foundation sprint. Acceptance criteria and the staged
  rollout/rollback contract are tracked in
  `docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md`.

All 19 sprints below remain officially `PENDING`. Execute them in numerical
order and do not skip the first pending sprint.

| Sprint | Reconciled status |
|---|---|
| NR-9.5 Child Safety Hardening | **COMPLETE + MERGED (2026-07-30, PR #62).** Folds B25 + C33. SLA-miss escalation (4h/24h ladder) + AI tutor/lab moderation (groundedAnswerService.ts, planLabAction.ts, explainLabState.ts) + platform fallback contact, all real-walkthrough-verified. A full-codebase sweep before merge found and fixed a second real gap (the lab-AI surfaces) and found-but-deferred a third (grading cluster, now NR-9.6). See `project_nr9_5_child_safety_hardening.md` in session memory for full evidence. |
| NR-9.6 Grading Surface Moderation Audit | **COMPLETE (2026-07-30).** Confirmed `homeworkGrader.ts`/`homework-grader.ts` are separate features, not duplicates — fixed independently. Real finding: raw unmoderated `aiFeedback` was shown to students immediately regardless of the 72h auto-release timer; fixed both the generation-time moderation on all 4 grading functions AND the display-gate exposure path. Real-walkthrough-verified. See `project_nr9_6_grading_moderation_audit.md` in session memory. |
| NR-3 Load-Test Identity Pool | **VALID — next sprint.** `DATABASE_URL` pooling already verified 2026-07-30 (see below); no longer a blocker. |
| NR-4 k6 Moderate 1K VU | **VALID — blocked by NR-3.** No production 1K-VU proof is recorded. |
| NR-5 k6 Peak 5K VU + AI Burst | **VALID — blocked by NR-4.** No peak or AI-burst proof is recorded. |
| NR-6 Middleware Portal Hardening | **COMPLETE (2026-08-01, PR #70).** Started out of sequence, ahead of NR-4/NR-5, as a user-directed budget-driven reorder (see NR-4 row). Audited all 226 routes under `app/api/admin/`/`app/api/platform/`; found zero unprotected routes (every route already enforces real authorization, some via record-scoped service-layer checks where the legitimate role varies per record). Added an authentication-only backstop in `middleware.ts` for `/api/admin/*`/`/api/platform/*` (deliberately not role-gated, to avoid breaking legitimate non-ADMIN flows like a TEACHER approving a TEACHER-scoped item) plus 5 integration tests. See `project_nr6_middleware_portal_hardening.md` in session memory. |
| NR-7 Systematic Tenant Access Guard | **VALID.** Existing tenant controls do not replace the required route-wide IDOR audit. |
| NR-8 RBAC Expansion + SSO Fix | **VALID.** Governance/export permission audit and school-assignment SSO gate remain. |
| NR-9 Audit Immutability + Pen Test | **PARTIAL, 2026-08-01.** Database-layer append-only enforcement is DONE and live-verified in production (triggers confirmed active via direct Postgres query, not just trusted from the commit). External penetration testing remains — see the standing external-action item below. |
| NR-10 Student Fail-Closed Curriculum Routing | **COMPLETE + MERGED (2026-08-02, PR #74, merge commit `ccdcab84`).** Most deliverables (work-detail gate, lesson catalog filter, admin+MOE coverage dashboards) already existed from a 2026-05-23 pre-plan commit (`775b59bb`); the real gap found and fixed this sprint was `/api/student/today`'s own scheduledWork queries never filtering on content status. |
| NR-11 MOE Published Backlog Approval | **REFRAMED, COMPLETE + MERGED (2026-08-03, PR #75, merge commit `7b3f07e2`).** The literal "389 published" target is stale and already satisfied (live backlog is 13 rows, under the plan's <50 gate) — it was resolved by automated scripts (`bulk-approve-published.ts`, `promote-enriched-lessons.ts`), not MOE review; ~95% of live approved content has no human approver identity and no audit-log entry. Fixed the real, fixable gap: MOE_OFFICIAL/MOE_SUPER_ADMIN held `CURRICULUM_APPROVE` permission but every approve/reject/bulk-review route hard-required ADMIN role or platform-admin, locking MOE out entirely (same bug class as NR-8). See `CURRENT_EXECUTION_STATE.md` for full detail and the known UI-gap follow-up. |
| NR-12 Critical Grade Deserts | **VALID.** Requires live coverage evidence for Grades 2 and 9. The curriculum risk-triage prerequisite is COMPLETE on `feat/curriculum-risk-triage` as of 2026-08-04, pending human review/merge; new automated Grade 2/9 approvals must use that shared path and its 3,500-word minimum. |
| NR-13 Grades 5–8 Gap Closure | **VALID.** Requires live coverage evidence, including English and Social Studies. |
| NR-14 National Audio Pipeline | **VALID.** Requires provider funding verification and less than 1% unexplained audio gaps. |
| NR-14.5 Auto-Grading Fairness Review | **VALID — new 2026-07-30**, folds C35. |
| NR-15 Unified Ops Dashboard | **VALID.** Monitoring, alert delivery, on-call ownership, and an incident drill remain. |
| NR-16 Playwright CI + Phase Close | **VALID / PARTIAL.** Unit/typecheck CI exists; the specified production Playwright gate remains. |
| NR-17 DR Drill + Export Isolation | **VALID.** Restore/rollback drill and concurrent export-isolation proof remain. |
| NR-17.5 Data Retention + Minors Legal Mapping | **VALID — new 2026-07-30**, folds B24 + C14. |
| NR-18 MOE Dashboard + Certification | **VALID.** Requires real load results, legal/residency evidence, and MOE sign-off. |
| NR-18.5 Governed Export Completeness | **VALID — new 2026-07-30**, folds B26. |
| NR-19 County Seed + Bulk Onboarding | **VALID.** Fifteen-county and staging onboarding proof remain. |
| NR-20 National Support + Training | **VALID.** Support SLA, multilingual training, live-SMS checklist, and district dashboard remain. |
| NR-21 National Launch Sign-Off | **VALID — terminal gate.** Blocked by every preceding required criterion. |

## Phase B pre-pilot backlog

Sources:

- `docs/audits/2026-06-pre-pilot-blockers.md`
- `docs/audits/2026-07-21-phase-b-doc-b-additions.md`

| ID | Reconciled status |
|---|---|
| B1 Inbound SMS webhook authentication | **VALID.** No verified provider-signature/authentication boundary. |
| B2 Per-IP login throttling | **VALID.** Credential login is still principally identifier-limited. |
| B3 CSP enforcement | **VALID.** Policy remains report-only or contains `unsafe-inline` allowances. |
| B4 Alert drills | **VALID.** No completed real alert drill evidence. |
| B5 Database restore test | **VALID.** Backup-related code is not evidence of a successful restore. |
| B6 Cron freshness monitoring | **PARTIAL.** Some agents/cron paths publish heartbeats; full scheduled-job coverage does not exist. |
| B7 Student large-font control | **VALID.** Accessibility toggle is not mounted in the student experience. |
| B8 Audio coverage | **VALID.** Principally covered by NR-14. |
| B9 Serve-time lesson quality gate | **VALID.** Principally covered by NR-10 and NR-11. |
| B10 Per-message SMS cost accounting | **PARTIAL.** Guardian-agent SMS has segment/cost controls, but general delivery records lack complete cost accounting. |
| B11 Guardian erasure workflow | **VALID.** Policy/contact instructions exist; an operational erasure workflow does not. |
| B12 Multi-child guardian digest deduplication | **VALID.** Exact-one-digest behavior lacks dedicated proof. |
| B13 Moderation SLA visibility | **VALID.** Oldest-pending age and trend evidence remain absent. |
| B14 At-risk drill-down | **POSSIBLY STALE / PARTIAL.** Counts and student detail exist; the exact dashboard-to-list workflow needs a real walkthrough. |
| B15 Teacher assignment undo | **DONE / STALE MEMORY.** Teacher timetable unassignment exists and is tested. |
| B16 Forgot-password E2E | **POSSIBLY STALE.** Code exists; live email delivery and completion remain unverified. |
| B17 Empty/error-state quality pass | **VALID.** No comprehensive signed audit exists. |
| B18 MOE and Guardian error boundaries | **VALID.** Both segment-level boundaries remain absent. |
| B19 Low-end Android/3G performance | **VALID.** No device/network measurement evidence. |
| B20 Resend sending domain | **CONFIRMED STILL BROKEN, ELEVATED TO SAFETY-CRITICAL (2026-07-30).** Live Resend API check during NR-9.5 confirms `liberialearn.edu.lr` domain status is still `"failed"` — unverified since first found 2026-06-24, over a month with no fix. This is no longer just "all transactional email is undeliverable": it now directly blocks NR-9.5's real 24-hour safeguarding escalation email (the platform-level fallback contact) from ever actually sending. The code is correct and fails loud (logged, not swallowed) rather than silently — but the channel itself does not work. **Action needed, not just tracking:** FA (or whoever holds Resend/DNS access) must complete domain verification at resend.com/domains. Treat this at safety-escalation priority, not generic infra backlog priority, until closed. |
| B21 Twilio trial limitations | **POSSIBLY STALE.** Requires current account/provider confirmation. |
| B22 Onboarding schedules first lesson | **VALID.** Wizard completion remains hardcoded without creating scheduled work. |
| B23 Agent notification cross-talk | **PROCESS NOTE, NOT CODE BACKLOG.** Preserve as a concurrency and verification warning. |
| B24 Retention enforcement | **VALID — folded into NR-17.5** (2026-07-30). No scheduled purge/anonymization workflow with exceptions and audit evidence. |
| B25 Proactive safeguarding alerting | **PARTIAL — folded into NR-9.5** (2026-07-30). Inbox/push notification core exists; SLA-miss alerting, retry/failure operations state, and complete delivery evidence remain. |
| B26 Governed export generation | **VALID — folded into NR-18.5** (2026-07-30). Every advertised export type needs real generation/storage and round-trip verification. |

## Phase C national-readiness backlog

Source: `docs/audits/2026-06-national-rollout-roadmap.md`

| ID | Reconciled status |
|---|---|
| C1 1.5M synthetic/national load testing | **VALID — NR-3 through NR-5.** |
| C2 National rollup query scaling | **VALID — NR-5 and NR-18.** |
| C3 Pooler capacity under concurrency | **VALID.** Production pool endpoint must first be verified. |
| C4 Vetted HTML sanitizer | **DONE / STALE MEMORY.** DOMPurify-based sanitization is present. |
| C5 Systematic tenant IDOR testing | **VALID — NR-7.** |
| C6 Third-party penetration test | **VALID — NR-9.** |
| C7 Blob URL enumeration review | **VALID.** No signed review was found. |
| C8 CVE remediation and Dependabot | **VALID.** No complete current sign-off was found. |
| C9 Secret rotation/history cleanup | **VALID.** No complete rotation/history evidence was found. |
| C10 Data-residency attestation | **VALID — NR-18 and NR-21.** |
| C11 Clean-exit/vendor-lock-in proof | **VALID — NR-17 and NR-18.** |
| C12 Dashboard/export parity | **VALID — NR-18.** |
| C13 Audit-log completeness | **VALID — NR-8 and NR-9.** |
| C14 Liberian legal mapping | **VALID — folded into NR-17.5** (2026-07-30), also gates NR-18/NR-21. |
| C15 WCAG 2.1 AA audit | **VALID — NR-20.** |
| C16 Keyboard navigation for labs | **VALID — NR-20.** |
| C17 Near-100% lesson audio | **VALID — NR-14.** |
| C18 Accommodation time extensions | **VALID.** |
| C19 Reading-level verification | **VALID — NR-12 and NR-13.** |
| C20 Image-failure fallback | **VALID.** |
| C21 30MB offline-pack budget | **VALID.** |
| C22 Offline sync/conflict scale | **VALID — NR-17.** |
| C23 Bulk moderation actions | **VALID — NR-11 and NR-20.** |
| C24 Principal parent-SMS visibility | **VALID.** |
| C25 Principal teacher-activity audit | **VALID.** |
| C26 Destructive-action confirmations | **VALID.** |
| C27 Teacher no-ID UX | **VALID.** |
| C28 Preview-as-student fidelity | **VALID.** |
| C29 National SMS budget alerts | **VALID — NR-15 and NR-20.** |
| C30 Feature-phone encoding | **PARTIAL.** GSM/UCS segment logic exists in the guardian agent; all SMS-producing paths still need verification. |
| C31 Family/multi-member model | **VALID, LOWER PRIORITY.** Current guardian collision handling is safe but does not provide full household-selection UX. |
| C32 Self-service erasure | **VALID.** Overlaps B11 and B24. |
| C33 Student AI moderation | **PARTIAL — folded into NR-9.5** (2026-07-30). Agent-platform moderation exists; tutor-wide input/output coverage needs a formal audit. |
| C34 National AI cost controls | **PARTIAL.** Per-user/daily controls exist; national-volume rebaselining and alerting remain. |
| C35 Grading fairness review | **VALID — folded into NR-14.5** (2026-07-30). |
| C36 Non-shaming response audit | **VALID.** |
| C37 Migration drift CI | **VALID.** No complete `prisma migrate diff` CI gate was found. |
| C38 Full tests/typecheck in CI | **DONE / STALE MEMORY.** Current CI includes these gates. |
| C39 Shipped TODO/FIXME cleanup | **DONE / STALE MEMORY.** Current hits are validation or prompt literals, not unfinished shipped implementations. |
| C40 Synthetic uptime monitoring | **VALID — NR-15.** |
| C41 Rollback rehearsal | **VALID — NR-17.** |
| C42 Demo cron rewrite | **PARTIAL / POSSIBLY STALE.** Route/method defects were fixed; a successful live midnight run is not recorded. |
| C43 First-time student orientation | **VALID — NR-20.** |
| C44 In-product help everywhere | **VALID — NR-20.** |
| C45 Onboarding/invite at scale | **VALID — NR-8 and NR-19.** |

## Follow-ups found during NR-9.5 (data/onboarding, not code)

| Item | Status |
|---|---|
| 17/23 schools have zero ADMIN and zero `designatedSafetyStaffUserId` | **VALID, real production finding (2026-07-30).** Would notify nobody if a real safeguarding concern arose there. Most are load-test/walkthrough junk schools, but real-looking names are in the list: Monrovia Central School, Nimba County Academy, Bong Community School. NR-9.5 added a platform-level email fallback (`PLATFORM_SAFEGUARDING_ESCALATION_EMAIL`) so this no longer means "notifies nobody at all," but a real safety-staff/admin assignment per school is still the correct fix and is a data/onboarding task, not an engineering one. Whoever owns school onboarding should assign `School.designatedSafetyStaffUserId` (or at least one ADMIN user) for every real (non-test) school. |
| 23/23 schools have `designatedSafetyStaffUserId = null` | **VALID.** Expected to be set during pilot-school onboarding per Sprint 6.1's original spec; never enforced or followed up on. Same owner/fix as the row above. |

## Follow-ups found during NR-7 (tenant access guard)

| Item | Status |
|---|---|
| School-level AI agent cost/usage visibility for school ADMINs | **VALID, new 2026-08-01.** NR-7 closed a real cross-school data leak by requiring `requirePlatformAdmin()` on `admin/agents/{cost,goals,triggers,route,[name]/toggle}` (a school ADMIN could previously see every other school's per-user AI spend and flip the platform-wide agent kill switch). Correct fix, but it also means ordinary school ADMINs now have zero visibility into their own school's AI agent usage/cost, because `AgentInvocation`/`AgentCostAccounting`/`AgentGoal`/`AgentControl` have no `schoolId` column at all — there was never a real per-school view to fall back to. If school-level AI cost visibility is wanted as a real feature, it needs a schema change (add `schoolId` to these tables, backfill where derivable, wire it into every invocation-recording path) plus proper per-school-filtered queries — not a permission relaxation back to the pre-NR-7 state, which was the actual vulnerability. Not scoped or started. |

## Additional memory-generated work

These findings came from retained project/session memory and were verified
against the current repository where local evidence was available.

| Item | Reconciled status |
|---|---|
| External penetration test (NR-9 deliverable 2) | **VALID EXTERNAL ACTION, new 2026-08-01.** DB-layer audit-log immutability (NR-9's other deliverable) is done and live-verified. This one genuinely requires engaging a real third-party pen-testing vendor — not something an engineering session can perform. A scope brief already exists at `docs/security/PEN_TEST_BRIEF.md` (drafted 2026-05-22, grey-box web app test, P0/P1/P2 attack surface, demo accounts, known-fixed-issues list) and is ready to hand to a vendor as-is; review it for currency before sending, since it references NR-6/NR-8 fixes by name and should be re-checked against whatever has shipped since. Once a vendor returns findings, remediate CRITICAL/HIGH and record the remediation table in `docs/MOE_PRODUCTION_CERTIFICATION.md` per the gate. User explicitly deferred this 2026-08-01 rather than have it block NR-9's closure. |
| Production pooled `DATABASE_URL` verification | **DONE / VERIFIED 2026-07-30.** Confirmed `aws-1-us-east-2.pooler.supabase.com:6543` with `pgbouncer=true` via a `vercel env pull --environment=production` snapshot (`.env.production`, pulled 2026-06-01) cross-checked against the Vercel project's env-var metadata (`GET /v9/projects/.../env`, dumped 2026-07-23): the production `DATABASE_URL` variable's `createdAt` equals `updatedAt` at 2026-05-19T17:12:51Z (the day after NR-1's completion date) with no update since, and no later change is possible without moving that timestamp. `DIRECT_URL` correctly targets the unpooled host on 5432. No live-today API pull was possible — the stored `VERCEL_TOKEN` in `.env.local` returns `invalidToken` on every REST call and the Vercel CLI is not installed; see the new operational item below. |
| Vercel REST API token is dead | **VALID.** `VERCEL_TOKEN` in `.env.local` (the one a 2026-07 session added "for future Vercel API access") is revoked/expired — every `api.vercel.com` call returns `{"error":{"invalidToken":true}}`. The Vercel MCP plugin tools still work (separate OAuth), covering projects/deployments/logs, but not encrypted env-var *values*. Generate a fresh token and update `.env.local` before relying on direct API/CLI env pulls again. |
| Whisper Mode release | **VALID.** Keep the feature flag disabled until deliberate approval and a real device with an active push subscription receives delivery. |
| Deterministic post-hoc Teaching Runtime grounding verifier | **VALID.** Current runtime depends on governed tools and prompt/tool reporting; this stronger verifier was not built. |
| Continuous real-time audio/video Teaching Runtime v2 | **DEFERRED.** V1 is deliberately turn-based. |
| Autonomous NR loop driver | **VALID.** Design exists; driver does not. One sprint per cycle, branch-only commits, mandatory live re-verification, and hard escalation stops remain required. |
| Supabase, ElevenLabs, and Fal.ai funding state | **POSSIBLY STALE.** Check live; independently verify ElevenLabs pricing and balance before audio spending. |
| Curriculum daily budget | **VALID OPERATIONAL CONTROL.** Confirm `AI_CURRICULUM_DAILY_BUDGET_USD`; it remains the bulk-generation pacing limit. |
| Production homework pipeline | **VALID.** A small dataset/backfill script exists, not a continuous governed production pipeline. |
| Production labs-generation pipeline/count | **POSSIBLY STALE / PARTIAL.** A one-off generation script exists and 12 interactive labs are shipped, but generated production-row counts need a live database query. |
| Curriculum Health / Content Lifecycle Agent | **VALID.** Not built; v1 must be detect-and-propose only and escalate irreversible changes. |
| Minister Jarso Jallah outreach status | **POSSIBLY STALE.** FA must confirm whether the drafted message was sent. |
| MOE positioning | **VALID STRATEGY NOTE.** Position LiberiaLearn as complementary Grades 4–12, WAEC, and AI tutoring rather than competitive with the Ministry's Grades 1–3 platform. |
| UNDP Liberia outreach | **DEFERRED.** Wait for credible coverage counts, functioning content pipelines, and production readiness. |
| Managed-device kiosk/MDM deployment | **DEFERRED.** Do not build until a pilot school's hardware and IT constraints are known. |
| Orange Liberia inbound SMS confirmation | **VALID EXTERNAL DECISION.** Confirm mobile-originated-message support before provider-specific inbound work. |
| Guardian shared-phone reply selection | **DEFERRED / CONDITIONAL.** Current ambiguity handling fails safely; `Reply A/B` UX is optional unless pilot friction proves a need. |
| Guardian phone-update administration | **VALID.** Agent request tooling exists; dedicated admin inbox/action and old-conversation cleanup remain unbuilt. |
| WAEC Geography mastery mapping | **VALID / PARTIAL.** Geography curriculum exists, but mastery logic lacks dedicated Geography handling. |
| WAEC Literature treatment | **VALID PRODUCT DECISION.** Decide whether to merge into English or build a dedicated corpus. |
| Real WAEC past-paper item bank | **VALID CONTENT WORK.** Generated/cached practice is not a licensed or curated past-paper bank. |
| WAEC mastery feature activation | **POSSIBLY STALE EXTERNAL CONFIG.** Requires production environment verification and deliberate activation. |
| Teacher lesson-editor LaTeX support | **DEFERRED V2.** Core TipTap editing is built; math authoring is not. |
| External outcome/pathway integrations | **DEFERRED / PARTNER-GATED.** Current pathway connectors remain placeholders. |
| Training V2 persistent badges and individual adoption analytics | **DEFERRED PRODUCT OPTIONS.** Not part of the current mandatory training scope. |
| Upstash Redis credentials missing on Vercel Preview environment | **VALID, new 2026-08-01 (found during NR-6).** `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set in production but not on Preview, so the deliberate rate-limiter hard-fail (`lib/rateLimit.ts`, NR-0/NR-1's Upstash hard-fail control, working as designed) blocks all login on every PR preview deployment — confirmed live on PR #70's preview URL, unrelated to that PR's own change. This made a genuine pre-merge authenticated-flow walkthrough impossible for NR-6; the gap was covered instead with targeted unit tests plus a full code audit, which was accepted as sufficient this once, but should not become the standing substitute. Add Upstash credentials to the Preview environment (same values as production, or a dedicated preview-scoped Upstash database for isolation) before the next sprint that needs to verify an authenticated flow pre-merge — this project's real bugs have repeatedly only surfaced via an actual login and click-through, not tests alone (see e.g. NR-9.5/NR-9.6's live-walkthrough findings). |

## Completed or explicitly resolved memory notes

The following notes are retained to prevent completed work from being
rediscovered as pending:

- The root context-loading chain is fixed. `CLAUDE.md` points to the canonical
  live documents, and obsolete plans are marked superseded.
- Mobile audit commit `d8da8453` is on `main`. The six later files failed the
  required full gate and were explicitly discarded; they are not shipped or
  pending.
- The mobile audit covered remediation of the existing mobile web/PWA
  experience. It was not a separate native-app build.
- The stale mobile-audit and load-test-validation worktrees were removed.
- Pendulum, Molecule Motion, Human Heart, and the later lab batches are
  complete; 12 interactive labs are recorded live.
- MOE/admin media analytics, batch audio controls, and video verification were
  subsequently implemented.
- The `StudentBadgeAward` migration exists.
- Agent moderation, translation, and per-user daily cost enforcement exist.
- Offline queue support for lesson/lab delivery events exists.
- Audit-log composite indexing and streaming CSV work exist.
- Student-import queueing, batch status, tenant isolation, and
  RFC4180/OneRoster handling exist.
- Public enrollment rate limiting and forced teacher temporary-PIN changes
  exist.
- Autonomous cron path/method mismatches were corrected.
- Teaching Runtime Tasks 1–16 are merged. Only release/device verification and
  separately deferred enhancements remain.

## Unattended-loop coverage

There is no unattended loop driver today.

The proposed driver discovers only the next `PENDING` NR sprint in
`NATIONAL_ROLLOUT_EXECUTION_PLAN.md`. It does not automatically execute every
item in this consolidated backlog. Before building the driver, define an
explicit mapping policy for non-NR items; do not silently treat the NR sequence
as full backlog coverage.

**2026-07-30 partial fix:** B24, B25, B26, C14, C33, and C35 were folded into
the NR sequence as decimal sub-sprints (NR-9.5, NR-14.5, NR-17.5, NR-18.5) so
a future driver that only walks the NR table will now pick them up. This does
not close the general mapping-policy gap — any other Doc B/C item, or any new
finding, still needs an explicit NR slot (or a different driver design) before
an unattended loop can be trusted to see it.
