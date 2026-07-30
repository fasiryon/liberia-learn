# LiberiaLearn Consolidated Backlog

**Status:** Canonical project-wide backlog  
**Reconciled:** 2026-07-30  
**Next national sprint:** NR-9.5, Child Safety Hardening (reordered ahead of
NR-3 on 2026-07-30 by explicit user decision — see the entry below and
`NATIONAL_ROLLOUT_EXECUTION_PLAN.md`'s "How execution works" step 2). NR-3,
Load-Test Identity Pool, follows once NR-9.5 completes.

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

All 19 sprints below remain officially `PENDING`. Execute them in numerical
order and do not skip the first pending sprint.

| Sprint | Reconciled status |
|---|---|
| NR-9.5 Child Safety Hardening | **VALID — next sprint (reordered 2026-07-30).** Folds B25 (safeguarding alerting) + C33 (AI tutor moderation audit). Runs ahead of NR-3 by explicit user decision: child-safety risk on the population this project exists to protect is a different category than scale risk, and doesn't queue behind load-test proof. |
| NR-3 Load-Test Identity Pool | **VALID — follows NR-9.5.** `DATABASE_URL` pooling already verified 2026-07-30 (see below); no longer a blocker. |
| NR-4 k6 Moderate 1K VU | **VALID — blocked by NR-3.** No production 1K-VU proof is recorded. |
| NR-5 k6 Peak 5K VU + AI Burst | **VALID — blocked by NR-4.** No peak or AI-burst proof is recorded. |
| NR-6 Middleware Portal Hardening | **VALID.** Formal portal-wide middleware gate remains outstanding. |
| NR-7 Systematic Tenant Access Guard | **VALID.** Existing tenant controls do not replace the required route-wide IDOR audit. |
| NR-8 RBAC Expansion + SSO Fix | **VALID.** Governance/export permission audit and school-assignment SSO gate remain. |
| NR-9 Audit Immutability + Pen Test | **VALID.** Database-layer append-only enforcement and external penetration testing remain. |
| NR-10 Student Fail-Closed Curriculum Routing | **VALID.** Approved-only routing must be proven across every student content path. |
| NR-11 MOE Published Backlog Approval | **VALID.** Requires fresh production backlog counts and MOE approval evidence. |
| NR-12 Critical Grade Deserts | **VALID.** Requires live coverage evidence for Grades 2 and 9. |
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
| B20 Resend sending domain | **POSSIBLY STALE.** Requires current provider-dashboard confirmation. |
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

## Additional memory-generated work

These findings came from retained project/session memory and were verified
against the current repository where local evidence was available.

| Item | Reconciled status |
|---|---|
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
