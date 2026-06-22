# DOC C — National Rollout Roadmap

**Audit:** WAVE 5 — Comprehensive National-Rollout Readiness Audit
**Date:** 2026-06
**Scope of this doc:** Items that do NOT block a first single-school pilot but must be resolved before signing a national MOE contract.
**Tiers:** T1 = address before national go-live; T2 = address during phased rollout; T3 = continuous-improvement / nice-to-have.
**Note on depth:** Per the audit's time-budget rules, perspectives 9 (disability) and 10 (new user) were given reduced depth at this stage; several items below are reasoned from architecture + the perspective's priorities rather than individually file-verified, and are marked `(reasoned)`.

---

## SCALE & PERFORMANCE

### C1 — National-scale load testing (1.5M synthetic students) — T1
- **Severity:** HIGH · **Perspectives:** SRE, MOE Official
- **Evidence:** `docs/LOAD_TEST_RESULTS.md`: Baseline 100 VUs PASS (p95 602ms), AI Load 50 VUs PASS, **Moderate 1000 VUs FAIL** (p95 8.47s, 34.7% errors). The failure is *partly* a test artifact (700 VUs sharing one student credential → auth rate-limit) and *partly* real (Vercel free-tier concurrency cap). Prior memory also records a 2000-VU run with ~81% errors / p95 ~35s.
- **Roadmap:** Re-run with per-VU credentials on production-tier infra; model the real concurrency of a national cohort; establish capacity headroom and autoscaling limits.
- **Effort:** 1 week.

### C2 — National rollup query scaling — T1
- **Severity:** HIGH · **Perspectives:** MOE Official
- **Evidence:** `lib/moe/liveDashboard.ts`, `lib/reporting/national/*` aggregate via joins over `StudentSession`/`School`/`ScheduledWork`. Not validated at 1.5M-student volume.
- **Roadmap:** Seed 1.5M synthetic records; profile national/county rollups; add materialized rollups or pre-aggregation if p95 regresses.
- **Effort:** 1 week.

### C3 — pgbouncer / connection-pool capacity under national concurrency — T1
- **Severity:** MEDIUM · **Perspectives:** SRE
- **Evidence:** League route already carries a 1s shield "so a cold-cache league DB query never competes with today/lessons for pgbouncer connections" (`app/api/league/route.ts:28-34`) — connection contention is a known pressure point.
- **Roadmap:** Capacity-plan pooled connections; consider read replicas for reporting.
- **Effort:** 3 days.

## SECURITY (national hardening)

### C4 — Replace ALL regex HTML handling with a single vetted sanitizer — T1
- **Severity:** HIGH · **Perspectives:** Security
- **Evidence:** Beyond A1, `renderSimpleMarkdown` is used across student/teacher/grading/adaptive surfaces. Standardize on one sanitizer module so future render sites can't reintroduce the gap.
- **Effort:** 2 days.

### C5 — Tenant-isolation (cross-school IDOR) systematic test pass — T1
- **Severity:** HIGH · **Perspectives:** Security, MOE Official, Principal
- **Evidence:** Spot checks are good (e.g. `wave4d` verifies `classId` belongs to the teacher's school; league exposes only school aggregates). But there is no exhaustive cross-tenant test matrix across all 508 routes.
- **Roadmap:** Add a test harness that, for every resource-bearing route, asserts a school-A actor cannot read/write school-B resources.
- **Effort:** 1 week.

### C6 — Third-party penetration test — T1
- **Severity:** HIGH · **Perspectives:** Security, MOE Official
- **Evidence:** `docs/security/PEN_TEST_BRIEF.md` exists (grey-box brief, NR-9) but no evidence a test was executed.
- **Roadmap:** Commission an external pen test against the attack surface in the brief; remediate P0/P1.
- **Effort:** external; 2–3 weeks calendar.

### C7 — Vercel Blob URL enumeration review — T2
- **Severity:** MEDIUM · **Perspectives:** Security
- **Evidence:** Offline packs, certificates OG images, and teacher videos use Blob storage. Confirm private blobs use unguessable tokens / signed access and are not publicly enumerable.
- **Effort:** 2 days.

### C8 — Full dependency-CVE remediation + Dependabot — T2
- **Severity:** MEDIUM · **Perspectives:** Senior Engineer
- **Evidence:** 42 vulns (1 critical dev-only, 21 high mostly dev/transitive). After A6's `npm audit fix`, set up automated dependency updates so this doesn't re-accumulate.
- **Effort:** 2 days.

### C9 — Secret rotation policy + remove fixture secrets from history — T2
- **Severity:** MEDIUM · **Perspectives:** Security, MOE Official
- **Evidence:** `.env.e2e` (A4) and generally: define rotation cadence for `NEXTAUTH_SECRET`, HMAC keys (`LIVE_DASHBOARD_SECRET`, share tokens), provider keys.
- **Effort:** 2 days.

## DATA SOVEREIGNTY & GOVERNANCE (MOE)

### C10 — Data residency attestation — T1
- **Severity:** HIGH · **Perspectives:** MOE Official
- **Evidence:** Platform runs on Vercel + Supabase/Upstash. The brief requires "all student data resides in identified geographic region." Document the actual region of every data store (DB, Redis, Blob, Sentry).
- **Roadmap:** Produce a data-residency attestation; pin storage regions; confirm Sentry data region + zero-retention settings.
- **Effort:** 3 days.

### C11 — Clean-exit / vendor-lock-in proof — T1
- **Severity:** HIGH · **Perspectives:** MOE Official
- **Evidence:** Export tooling exists (`lib/exports/governanceExport.ts`, `docs/ANONYMIZED_EXPORTS.md`). The brief requires MOE be able to revoke vendor access without losing data, and full per-school/county/national export on demand.
- **Roadmap:** Document and rehearse a full contract-termination data handover (complete dataset export in an open format + access revocation).
- **Effort:** 1 week.

### C12 — Reporting parity (dashboard counts == CSV export counts) — T1
- **Severity:** HIGH · **Perspectives:** MOE Official
- **Evidence:** Multiple aggregation paths (live dashboard, reports/generate, governance export). Numbers must reconcile across views or MOE trust erodes.
- **Roadmap:** Add a reconciliation test asserting dashboard, report, and export agree for the same scope/period.
- **Effort:** 3 days.

### C13 — Audit-log completeness coverage — T2
- **Severity:** MEDIUM · **Perspectives:** MOE Official, Principal
- **Evidence:** Audit immutability is enforced at the DB level (NR-9 triggers `prevent_audit_update`/`prevent_audit_delete`) — strong. Gap: confirm *every* state-changing action calls `logAudit` with actor + before/after state (some routes log, the coverage is uneven).
- **Roadmap:** Inventory state-changing routes vs `logAudit` calls; fill gaps; capture before/after where missing.
- **Effort:** 1 week.

### C14 — Liberian data-protection legal mapping — T1
- **Severity:** HIGH · **Perspectives:** MOE Official
- **Evidence:** `docs/PRIVACY_GOVERNANCE.md` exists; needs explicit mapping to Liberian legal requirements for minors' data.
- **Effort:** legal review; 1 week calendar.

## ACCESSIBILITY & INCLUSION (national-grade)

### C15 — Full WCAG 2.1 AA audit — T1
- **Severity:** HIGH · **Perspectives:** Student with Disability
- **Evidence:** Good signals (all `<img>`/`<Image>` have alt text; `AccessibilityToggle` exists; `aria-pressed`/`aria-label` used). No comprehensive contrast/keyboard/screen-reader audit on record.
- **Roadmap:** Run axe/Lighthouse across key flows; manual screen-reader (NVDA/TalkBack) pass; fix contrast and focus-order issues.
- **Effort:** 1 week.

### C16 — Keyboard navigation for interactive labs — T2
- **Severity:** MEDIUM · **Perspectives:** Student with Disability
- **Evidence:** `components/labs/*` and `components/toolkit/*` are drag/touch-oriented (`DraggablePanel`, `Protractor`, etc.). Confirm keyboard operability or provide alternatives. `(reasoned)`
- **Effort:** 1 week.

### C17 — Audio narration to ~100% of served lessons — T1
- **Severity:** HIGH · **Perspectives:** Student with Disability, Student
- **Evidence:** Extends B8 from "Priority-1 ≥50%" to full coverage across the national curriculum.
- **Effort:** multi-week pipeline; gated on TTS budget.

### C18 — Quiz time-limit extension for accommodations — T2
- **Severity:** MEDIUM · **Perspectives:** Student with Disability
- **Evidence:** The adaptive engine has per-grade time allowances (`detectStuck` gives lower grades 1.5×) but no per-student accommodation flag. `(reasoned)`
- **Effort:** 3 days.

### C19 — Reading-level verification per grade — T2
- **Severity:** MEDIUM · **Perspectives:** Student with Disability, Student
- **Evidence:** Confirm lesson prose readability matches the grade it's tagged for (automated readability scoring across the corpus). `(reasoned)`
- **Effort:** 3 days.

## RESILIENCE & OFFLINE (low-connectivity national context)

### C20 — Low-bandwidth image-fail fallback verification — T2
- **Severity:** MEDIUM · **Perspectives:** Student
- **Evidence:** `components/LowBandwidthModeScript.tsx` exists. Confirm lessons render legibly when images fail to load (alt text + layout integrity). `(reasoned)`
- **Effort:** 2 days.

### C21 — Offline pack 30MB budget verification across grades — T2
- **Severity:** MEDIUM · **Perspectives:** Student
- **Evidence:** WAVE-3E offline packs + WAVE-4D teacher-lesson inclusion exist. Verify total pack size stays within a ~30MB budget for a typical grade, including teacher videos.
- **Effort:** 2 days.

### C22 — Offline submission sync at scale / conflict resolution — T2
- **Severity:** MEDIUM · **Perspectives:** Student, SRE
- **Evidence:** NR-14A idempotent offline homework submission + `docs/OFFLINE_SYNC_CONFLICT_RESOLUTION.md`. Validate behavior when thousands sync simultaneously after an outage.
- **Effort:** 3 days.

## TEACHER / PRINCIPAL WORKFLOW (scale)

### C23 — Bulk principal moderation actions — T2
- **Severity:** MEDIUM · **Perspectives:** Principal
- **Evidence:** Moderation is per-item (Wave 4). At national scale principals need approve-multiple / reject-multiple.
- **Effort:** 3 days.

### C24 — Principal visibility into all parent SMS for their school — T2
- **Severity:** MEDIUM · **Perspectives:** Principal
- **Evidence:** `SMSDeliveryLog` is indexed by `schoolId`; a principal-facing view of guardian SMS interactions should be confirmed/built.
- **Effort:** 3 days.

### C25 — Principal audit of any teacher's activity log — T2
- **Severity:** MEDIUM · **Perspectives:** Principal
- **Evidence:** Audit logs exist; confirm a principal-scoped UI to review a teacher's actions.
- **Effort:** 3 days.

### C26 — Destructive-action confirmations everywhere — T2
- **Severity:** MEDIUM · **Perspectives:** Principal, Teacher, Student
- **Evidence:** Verify all destructive actions (unpublish, delete, reassign, demo reset) require confirmation and cannot cause accidental data loss. `(reasoned)`
- **Effort:** 2 days.

### C27 — "No-ID" UX guarantee for teachers — T2
- **Severity:** LOW · **Perspectives:** Teacher
- **Evidence:** Brief requires teachers never see raw `contentId`/`classId`. Audit teacher-facing surfaces for leaked IDs. `(reasoned)`
- **Effort:** 2 days.

### C28 — Lesson preview-as-student fidelity — T2
- **Severity:** MEDIUM · **Perspectives:** Teacher
- **Evidence:** Preview uses the same render path as the student viewer (per Wave 4 design). Confirm parity including audio/labs/quiz, not just body HTML.
- **Effort:** 2 days.

## GUARDIAN / SMS (scale)

### C29 — SMS budget alerting at national volume — T1
- **Severity:** HIGH · **Perspectives:** MOE Official, Guardian, SRE
- **Evidence:** Extends B10. With a cost field in place, add national SMS-spend forecasting + hard caps; national digest volume could be a large recurring cost.
- **Effort:** 3 days.

### C30 — Feature-phone encoding safety for SMS — T2
- **Severity:** MEDIUM · **Perspectives:** Guardian
- **Evidence:** Confirm digest/quiz SMS use GSM-7-safe characters (no smart quotes/emoji that force UCS-2 and halve segment length / break feature phones). `(reasoned)`
- **Effort:** 2 days.

### C31 — Family/multi-member access model — T3
- **Severity:** LOW · **Perspectives:** Guardian
- **Evidence:** `StudentGuardian` links User→Student many-to-many already supports multiple guardians. Validate grandparents/siblings scenarios and per-guardian opt-out granularity.
- **Effort:** 3 days.

### C32 — Self-service right-to-erasure — T2
- **Severity:** MEDIUM · **Perspectives:** Guardian, MOE Official
- **Evidence:** Extends B11 from a manual pilot process to a guardian-initiated, auditable erasure workflow.
- **Effort:** 1 week.

## AI / SAFETY (national)

### C33 — Student-facing AI tutor input/output moderation — T1
- **Severity:** HIGH · **Perspectives:** Student, Security, MOE Official
- **Evidence:** Grounded answering exists (`lib/ai/rag/groundedAnswerService.ts`, hybrid retrieval NR-13) with some safety references. At national scale, confirm input moderation (off-topic / unsafe student prompts) and output safety for minors, with logging.
- **Effort:** 1 week.

### C34 — AI cost controls at national volume — T2
- **Severity:** MEDIUM · **Perspectives:** SRE, MOE Official
- **Evidence:** `check-ai-budget` cron exists (NR-15). Re-baseline daily/MTD caps for national usage (tutor + grading + generation).
- **Effort:** 2 days.

### C35 — Auto-grading fairness review (essay/code/AI-literacy) — T2
- **Severity:** MEDIUM · **Perspectives:** Student, Teacher, MOE Official
- **Evidence:** WAEC-rubric essay grading, Judge0 code grading, AI-literacy grading exist (NR-14B/C/D), all advisory. Before national high-stakes use, audit for bias and confirm teacher-override is always available.
- **Effort:** 1 week.

### C36 — Encouraging-not-shaming response audit — T2
- **Severity:** MEDIUM · **Perspectives:** Student
- **Evidence:** `StuckHelper` uses encouraging copy; extend a tone audit across all incorrect-answer / failure paths so the platform never shames a child. `(reasoned)`
- **Effort:** 2 days.

## ENGINEERING / OBSERVABILITY (national)

### C37 — Schema-vs-database drift check in CI — T2
- **Severity:** MEDIUM · **Perspectives:** Senior Engineer, SRE
- **Evidence:** `/api/health` checks `_prisma_migrations` pending (good). Add a CI `prisma migrate diff` gate so drift can't reach production (ties to A5 + the recorded-but-unapplied landmine).
- **Effort:** 2 days.

### C38 — End-to-end test suite in CI gate — T2
- **Severity:** LOW (already strong) · **Perspectives:** Senior Engineer
- **Evidence:** **421 test files / 3,529 tests pass end-to-end** (verified this audit) and `tsc --noEmit` is clean (0 errors). Ensure the full suite (not per-file) and typecheck run as a required CI gate before deploy.
- **Effort:** 1 day.

### C39 — Resolve TODO/FIXME in shipped paths — T3
- **Severity:** LOW · **Perspectives:** Senior Engineer
- **Evidence:** 19 TODO/FIXME/HACK markers across `app/` + `lib/`. Triage; none found in auth/payment-critical paths during this pass, but worth clearing before national.
- **Effort:** 1 day.

### C40 — Synthetic monitoring / uptime checks on key flows — T1
- **Severity:** MEDIUM · **Perspectives:** SRE, MOE Official
- **Evidence:** `/api/health` + `/api/healthz` exist. Add external synthetic checks (login → today → lesson) with alerting, not just a health ping.
- **Effort:** 2 days.

### C41 — Deployment rollback runbook rehearsal — T2
- **Severity:** MEDIUM · **Perspectives:** SRE
- **Evidence:** `docs/ops/RUNBOOK.md` documents rollback. Rehearse an actual Vercel rollback + a migration rollback to confirm the procedure works under pressure.
- **Effort:** 1 day.

### C42 — Demo/keep-alive cron rewrite — T2
- **Severity:** LOW · **Perspectives:** Senior Engineer, SRE
- **Evidence:** Memory: `refresh-demo-schedule` is broken (not firing; would duplicate/resurrect demo lesson if it did); interim manual `backfill-demo-dates.ts` keep-alive. Rewrite deferred post-VSL — do it before national so demo environments are stable.
- **Effort:** 2 days.

## NEW-USER / ADOPTION (national)

### C43 — First-time orientation for students — T2
- **Severity:** MEDIUM · **Perspectives:** New User, Student
- **Evidence:** Confirm/build first-login orientation so a brand-new student reaches first completed lesson in <10 min. `(reasoned)`
- **Effort:** 3 days.

### C44 — In-product help reachable from every page — T2
- **Severity:** LOW · **Perspectives:** New User
- **Evidence:** `docs/moe-pilot-guide.md` exists (external). Add an in-product help entry point on all shells. `(reasoned)`
- **Effort:** 2 days.

### C45 — Onboarding/invite gating at scale — T2
- **Severity:** MEDIUM · **Perspectives:** Security, MOE Official
- **Evidence:** Google SSO invite-gate (NR-8: `SSO_INVITE` InviteToken) + onboarding routes exist. Validate the bulk-provisioning path for thousands of teachers/students per school.
- **Effort:** 3 days.

---

### Doc C total: 45 items (T1: 16, T2: 24, T3: 5) · estimated 2–4 weeks of focused engineering (excluding external pen test + legal review calendar time)
