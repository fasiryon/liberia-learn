# Audit Synthesis — All LiberiaLearn Audits, Compared and Reconciled

**Compiled:** 2026-09-04
**Method:** Every audit-shaped document under `docs/` was read in full (21
documents, 2026-01-29 through 2026-09-02), cross-referenced against the
canonical planning docs (`AGENTS.md`, `docs/roadmaps/CONSOLIDATED_BACKLOG.md`,
`docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`,
`docs/roadmaps/CURRENT_EXECUTION_STATE.md`), and spot-verified against the
current codebase (grep/read of the actual files each finding names) rather
than trusted at face value.

**Caveat — audit docs are frozen in time, the backlog is not.** Several early
audits (Gate 1/2/3/4, AUDIT-2, 2026-02 through 2026-03) "certified" security
properties that later audits (WAVE 5, the July engineering audit, the P1-D
internal security review) found genuinely broken again in other code paths.
This is not a contradiction — it means each early certification was accurate
for the surface it checked, not for the whole platform, and RBAC/tenant-scope
regressions kept recurring in *new* code even after being fixed elsewhere.
`docs/roadmaps/CONSOLIDATED_BACKLOG.md` (reconciled 2026-08-03) is the most
authoritative single source for current status, but it predates the P7-A/B/C
program (certified through 2026-09-02) entirely — it was not updated when
that program closed. Where this synthesis found a live discrepancy between a
doc's claim and the current repository, it says so explicitly with the grep
or read that resolved it, rather than picking one source to trust.

---

## 1. Audit inventory

| Date | Document | Scope | Headline finding |
|---|---|---|---|
| 2026-01-29 | `docs/internal/grading/SECURITY_AUDIT.md` | Grading security | **Never written.** File is a literal placeholder (`<PASTE SECURITY_AUDIT.md CONTENT HERE>`) since creation — no content ever existed. |
| 2026-02-24 | `docs/governance/COMPLIANCE_AUDITABILITY.md` | Audit-logging spec | Design/requirements doc, not a point-in-time audit — defines what `logAudit()` must capture. Used here as a reference contract, not a finding source. |
| 2026-02-26 | `docs/audits/AUDIT_GATE_1.md` + `AUDIT_GATE_1_REPORT_20260226.md` | RBAC/tenant/PII, post Block 13+14 | PASS 8/8, 100%. Early-phase static audit; runtime gate not executed (OS policy). |
| 2026-02-28 | `docs/rollout/AI_FACTORY_AUDIT.md` | AI Factory / curriculum generation compliance | 3 gaps (missing standards codes, tone guidance not injected, no feedback telemetry) — **all resolved same block.** |
| 2026-02-28 | `docs/rollout/AUDIT_2_REPORT.md` | Tenant isolation, RBAC, PII, audit logging, flags | PASS after 2 surgical fixes (null-schoolId guard, 2 missing audit-log calls). Certified "no cross-tenant leakage path." |
| 2026-03-01 | `docs/rollout/AUDIT_GATE_2_REPORT.md` | Same 8 categories, Blocks 22→25 delta | PASS 848/848 tests, "CERTIFIED FOR MOE DEPLOYMENT." |
| 2026-03-02 | `docs/audits/PROGRESS_AUDIT.md` | Whole-repo block-completion reconciliation | All 29 blocks + RR-6/RR-7 done; found `sprints/queue.json`/`ROADMAP_BLOCKS.md`/`prompts/` were never created (tracking gap, not a code gap). |
| 2026-03-02 | `docs/audits/GATE_3_CERTIFICATION.md` | Full pre-launch, 9 domains | GO. 2 Major findings: NextAuth login had no rate limit (M-1); in-memory rate limiter resets per Vercel cold start (M-2). **Both since fixed** (verified below). |
| 2026-03-02 | `docs/rollout/RR7_OFFLINE_AUDIT.md` | Offline/PWA infrastructure | Production-ready; 3 named gaps (`ACTION-OFFLINE-1`: lesson.completed/lab.session.update/lesson.delivered not wired to the domain queue). **Since fixed** (verified below). |
| 2026-03-13 | `docs/audits/GATE_4_CERTIFICATION.md` | RAG tutor, teacher co-creation, textbook compiler, schema | GO. 2 non-blocking majors (textbook fallback strings; MOE district drill-down placeholder sections). |
| 2026-04-23 | `docs/PHASE5_2_CURRICULUM_AUDIT_REPORT.md` | Curriculum coverage baseline | Grade 2 and Grade 9 near-zero content; SOCIAL_STUDIES empty G5-9; ENGLISH zero anywhere; recommended approving a 389-lesson published backlog as a "quick win." |
| 2026-04-23 | `docs/PHASE5_DUPLICATION_AUDIT.md` | Phase 5 duplication check | Clean — no parallel analytics/AI-routing/curriculum system was introduced. |
| 2026-06-22 | `docs/audits/2026-06-audit-summary.md` (WAVE 5) | Full national-rollout readiness, 10 perspectives, 70 findings | Platform fundamentally sound; **1 critical fix required before any external demo**: stored XSS via regex HTML sanitizer + no CSP. **XSS since fixed; CSP still open** (verified below). |
| 2026-07-23 | `docs/LIBERIALEARN_ENGINEERING_AUDIT.md` | Full-stack engineering audit, harsher lens | 66% pilot-complete, 48% nationwide-ready. Flagged failing/timed-out test suite, fragmented authorization, permissive CSP, VAPID key leak (fixed same commit), CSV-only backups. |
| 2026-07-29 (merged), release still gated | `docs/audits/TEACHING_RUNTIME_V1_FINAL_REPORT.md` | AI Teaching Runtime v1, 16-task sprint + separate mobile-audit cycle | COMPLETE and merged; production flag `AGENT_TEACHING_RUNTIME_ENABLED` deliberately still off; 6 mobile-audit P0/UX bugs fixed same cycle. |
| 2026-08-10 | `docs/security/INTERNAL_SECURITY_REVIEW_2026-08-10.md` | P0/P1 pen-test-brief items, compensating internal review (explicitly not the real pen test) | 1 CRITICAL (`/api/auth/login` brute-force oracle + hardcoded JWT fallback), 1 HIGH (cross-school grading-override IDOR), 2 MEDIUM. **All since fixed** (verified below, PR #85 per memory). |
| 2026-08-18 | `docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md` | Supabase RLS across staging + production | P0 — RLS disabled on 197-216 production tables and all 229 staging tables, staging actively exploitable via anon key. Default-deny RLS applied both sides; fine-grained policy matrix still not built (deferred, safe today only because no legitimate anon/authenticated Data API consumer exists). |
| 2026-08-19 | `docs/ops/P2C_FORENSIC_REMEDIATION_RECORD.md` | P2-C curriculum-benchmarking semantic defects | 4 defects fixed and live-verified against staging; CI has one pre-existing unrelated failure (legacy-migration manifest byte-count, CRLF-vs-LF); **NO-GO** recommendation pending human PR review of #86. |
| 2026-08-19 | `docs/ops/P2C_LEGACY_MANIFEST_PLATFORM_AUDIT.json` | Migration-manifest blob integrity | ALL_MATCH (128/128) — confirms the CRLF/LF root cause above, not a new problem. |
| 2026-08-28 (repository gate) | NR-12 evidence in `CURRENT_EXECUTION_STATE.md` | Grade 2/9 content-desert closure | COMPLETE in repo — 15 authored lessons in each of 10 core-subject cells; no production/staging mutation. |
| 2026-08-30 | `docs/roadmaps/NR14_5_GRADING_FAIRNESS_AUDIT.md` | Auto-grading fairness (quiz/code/essay/AI-literacy) | Answer-key leak (client-supplied `correctIndex`) and client-supplied code test-cases both fixed; AI grading is advisory-only with teacher override; no demographic-specific normalization found. |
| 2026-08-31 | `docs/audits/P1_P2_P5_P7_RECERTIFICATION_2026-08-31.md` | Current-source recertification of Priorities 1/2/5/7 against original acceptance criteria | Most subphases "ENGINEERING COMPLETE — EXTERNAL OPERATIONAL GATE REMAINS"; P1-D pen test still PARTIAL; P2-B has zero live reviewers; P7-C was PARTIAL at time of writing (later closed, see next row). |
| 2026-08-31 → 2026-09-02 | P7-A/B/C certification records in `CURRENT_EXECUTION_STATE.md` (PRs #112, #116, #120) | Governed measurement, controlled experiments, quality operations/release gates | All three now COMPLETE AND CERTIFIED at the repository level; remaining gates (live reviewer roster, real sampled traffic, applied migrations, on-call/monitoring) are explicitly external, not engineering, gaps. |

Additional certification/remediation records referenced above but not
separately tabulated (already covered by the entries they belong to):
`docs/audits/AUDIT_GATE_1.md.bak_*` (superseded drafts, not read),
`docs/internal/factory/quality-gates.json` (config, not a report),
`docs/P2B_QUALIFIED_REVIEW_OPERATIONS_FINAL_DESIGN.md` (design spec, not an
audit).

---

## 2. Cross-cutting findings — compare and contrast

### 2.1 RBAC / tenant-scope regressions (the single most recurring theme)

Every major audit round found *and fixed* a fresh instance of the same bug
class — a route with insufficient auth or scope checking — and every
subsequent audit found a new one elsewhere. This is not one unresolved bug;
it is a **structural pattern of centralization never being complete**:

| When found | What | Audit | Fix |
|---|---|---|---|
| 2026-02-28 | `GET /api/admin/students` — null-schoolId could produce an unscoped query | AUDIT-2 | Fixed same block |
| 2026-03-01 | `approve`/`reject` routes missing `schoolId` in `logAudit` | Gate 2 | Fixed same block |
| 2026-08-01 | 3 genuine cross-tenant gaps (LessonVideo, post-change-eval GET with **zero** auth of any kind, agents/* platform-wide routes) | NR-7 (memory + backlog) | Fixed, PR merged |
| 2026-08-01 | 11 MOE routes excluded MOE_SUPER_ADMIN via a literal string check; 2 referenced a dead "PLATFORM_ADMIN" role that could never match | NR-8 (memory + backlog) | Fixed, PR merged |
| 2026-08-03 | MOE_OFFICIAL/MOE_SUPER_ADMIN held the `CURRICULUM_APPROVE` permission but approve/reject/bulk-review routes hard-required ADMIN role — same bug class as NR-8, in a different subsystem | NR-11 (memory + backlog) | Fixed, PR #75 merged |
| 2026-08-10 | `/api/grading/[submissionId]/override` had a role check but no school-scope check — cross-school grade tampering | Internal Security Review | **Verified fixed**: `override/route.ts` now checks `existing.student.user.schoolId !== user.schoolId` |

**Read this as:** the *pattern* (add a route, forget the scope check) keeps
recurring across unrelated subsystems (dashboards, MOE approval, grading,
agent cost visibility). Six independent instances across seven months is
evidence that centralized enforcement is not yet load-bearing — each fix is
real and verified, but the next new route is not guaranteed to inherit it.
No audit has proposed (and none has been asked to build) a structural
backstop (e.g., a lint rule or a route-registration wrapper that fails a
route without an explicit scope declaration) — Gate 1's own "Next Steps"
list proposed exactly this in 2026-02-26 ("Add a static audit check to
ensure national endpoints are platform-admin-only") and it was never built.

### 2.2 Stored XSS / Content-Security-Policy

- **WAVE 5 (2026-06-22):** regex-based sanitizer in `lib/lessons.ts` allowed
  stored XSS via teacher-authored lesson content, fired in the principal's
  moderation-preview session and every approving student's session; no CSP
  existed as a backstop.
- **Verified now:** `lib/lessons.ts` uses `DOMPurify.sanitize()` — the XSS
  hole is fixed (confirmed by direct read of the file).
- **CSP is still not enforcing.** `next.config.js` ships
  `Content-Security-Policy-Report-Only` only, with `script-src 'self'
  'unsafe-inline' ...` — report-only mode never blocks anything, and
  `unsafe-inline` would defeat most of the protective value even if
  enforced. This matches `CONSOLIDATED_BACKLOG.md`'s B3 ("VALID... report-only
  or contains unsafe-inline") and the July engineering audit's independent
  finding of "report-only CSP with unsafe-inline" — three separate sources
  agree this is still open, as of this synthesis's direct read of the config.

### 2.3 Rate limiting on authentication

- **Gate 3 (2026-03-02):** flagged NextAuth login had no explicit rate limit
  (M-1) and the rate limiter was in-memory, reset by every Vercel cold start
  (M-2).
- **Internal Security Review (2026-08-10):** independently found a
  *different*, dead-code login route (`/api/auth/login/route.ts`) with zero
  rate limiting and a hardcoded JWT secret fallback that was the live signing
  key in production.
- **Verified now:** `lib/auth.ts` calls `checkRateLimit` for the credentials
  identifier; `lib/rateLimit.ts` is Upstash-Redis-backed
  (`@upstash/ratelimit`/`@upstash/redis`) with in-memory fallback only for
  non-production. The standalone `app/api/auth/login/route.ts` file no longer
  exists in the repository. **Both M-1/M-2 and the CRITICAL finding are
  resolved.**
- **Still open, lower severity:** `CONSOLIDATED_BACKLOG.md`'s B2 ("Credential
  login is still principally identifier-limited") and the Internal Security
  Review's #8 (secondary limiters on `/api/enroll`, forgot-password, register
  routes key on raw `X-Forwarded-For` rather than a normalized first-hop
  value) were not part of this synthesis's direct verification pass and
  should be treated as still open per the backlog's own 2026-08-03 status.

### 2.4 Offline queue wiring (`ACTION-OFFLINE-1`)

- First flagged in the RR-7 offline audit (2026-03-02) and repeated in
  `PROGRESS_AUDIT.md`'s technical-debt table and `AUDIT_GATE_2_REPORT.md`'s
  open-items list: `lesson.completed`, `lab.session.update`, and
  `lesson.delivered` were not wired to the partition-isolated app-level
  offline queue (service-worker HTTP replay covered them as a fallback).
- **Gate 3 Certification (2026-03-02, same date, later section) already
  recorded this fixed** ("production gap fix, commit `b43b56a`": all three
  routes import `enqueue` from `lib/offline/offlineQueue`), and this
  synthesis's direct grep confirms all three routes still import `enqueue`
  today. **Resolved**, and has been for the whole period since — the open
  mentions in RR7_OFFLINE_AUDIT.md and PROGRESS_AUDIT.md are simply earlier
  snapshots than Gate 3's same-day fix.

### 2.5 SMS webhook authentication

- WAVE 5's B1 (2026-06-22): unauthenticated inbound SMS webhook enabling
  answer spoofing and, once live SMS is enabled, cost abuse.
- **Verified now — split finding.** `app/api/webhooks/sms-inbound/route.ts`
  (added 2026-07-13) *does* verify an HMAC signature (`AT_WEBHOOK_SECRET`,
  conditional on the secret being configured). `app/api/webhooks/sms-reply/
  route.ts` — the two-way quiz-answer endpoint, which is what WAVE 5's
  finding actually describes (`Reply A, B, C, or D` quiz flow) — **has no
  signature verification of any kind**, confirmed by a direct read: it
  parses `from`/`text` from the raw request body and never checks an
  authentication header. **This finding is still genuinely open**, matching
  `CONSOLIDATED_BACKLOG.md`'s B1 status.

### 2.6 Grading integrity vs. grading moderation (two different findings, easy to conflate)

- **NR-14.5 Grading Fairness Audit (2026-08-30):** answer-key leak (client
  held `correctIndex`) and client-suppliable code test cases — both
  **integrity/cheating** bugs, both fixed (server-held keys, server-held
  Judge0 tests).
- **NR-9.6 (memory, 2026-07-30, not a separate doc but referenced across
  the backlog and NR plan):** a **content-safety/moderation** bug — raw
  unmoderated AI feedback text reached students immediately regardless of
  the 72h teacher-approval timer. Different subsystem, different bug class,
  same grading surface. Both are now fixed, but they are frequently
  discussed together in project history and should not be assumed to be the
  same finding when reviewing old notes.

### 2.7 RLS (Row Level Security) — the most severe *contained-but-incomplete* item

`docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md` (2026-08-11 finding,
2026-08-18 remediation) is the most severe single item on the whole platform:
RLS was disabled on all production and staging tables, and staging additionally
granted `anon`/`authenticated` full CRUD on nearly every table — actively
exploitable, not theoretical. Default-deny RLS is now active both sides
(verified in the doc via a live Security Advisor rerun showing
`rls_disabled_in_public: 0/0`). What is **not** done, by the audit's own
words: the full grant-inventory/access-path-map/per-table-policy-matrix
process. This is safe today only because no legitimate anon/authenticated
Data API consumer exists in the app (confirmed: the only Supabase client
usage is server-side Storage API, never PostgREST). If that ever changes,
the policy work must happen first — this is a standing constraint on any
future feature that wants direct client-side Supabase/PostgREST access, not
just a line item.

### 2.8 Curriculum coverage and the auto-approval governance gap

The April curriculum audit recommended approving a 389-lesson published
backlog as the fastest way to close Grade 5/7 coverage gaps. That literal
recommendation was later carried into NR-11's plan. When NR-11 actually
executed (per `CONSOLIDATED_BACKLOG.md` and session memory), the reframing
found the backlog had already been cleared — **by automated scripts
(`bulk-approve-published.ts`, `promote-enriched-lessons.ts`), not MOE
review** — and that roughly 95% of live approved content has no human
approver identity or audit-log entry. The audit's own recommended "quick
win" became the source of a governance finding two sprints later. This is
flagged in `project_curriculum_risk_triage_design` (session memory) as an
unresolved open policy question for NR-13 and beyond: should new content go
through real human review, or the same auto-gate scripts that produced this
gap.

---

## 3. Resolved / verified closed (with evidence)

| Finding | Source audit | Verification performed here |
|---|---|---|
| Stored XSS via regex sanitizer | WAVE 5 A1 | `lib/lessons.ts` reads `import DOMPurify from "isomorphic-dompurify"` and calls `DOMPurify.sanitize()` |
| `ACTION-OFFLINE-1` queue wiring (3 routes) | RR7 Offline Audit, Progress Audit, Gate 2 | All 3 routes (`work/[id]/complete`, `schedule/[id]/deliver`, `labs/sessions/[id]`) import `enqueue` from `lib/offline/offlineQueue` |
| NextAuth login rate limiting (Gate 3 M-1) | Gate 3 Certification | `lib/auth.ts` calls `checkRateLimit(\`credentials:${identifier}\`, ...)` |
| In-memory-only rate limiter (Gate 3 M-2) | Gate 3 Certification | `lib/rateLimit.ts` uses `@upstash/ratelimit` + `@upstash/redis`, in-memory only as non-prod fallback |
| `/api/auth/login` brute-force oracle + hardcoded JWT fallback (CRITICAL) | Internal Security Review #6 | File no longer exists in the repository |
| Cross-school grading-override IDOR (HIGH) | Internal Security Review #2 | `override/route.ts` checks `existing.student.user.schoolId !== user.schoolId` |
| MOE school-cohort export re-identification (MEDIUM) | Internal Security Review #3 | Route imports `MIN_COHORT_SIZE` and suppresses rows below it |
| AI Factory Gaps 1-3 (standards codes, tone guidance, feedback telemetry) | AI Factory Audit | Recorded resolved same block; no contrary evidence found |
| Answer-key leak / client-suppliable code tests | NR-14.5 Grading Fairness Audit | Fixed per the audit's own remediation section; PR #110 per `NATIONAL_ROLLOUT_EXECUTION_PLAN.md` |
| Grading moderation display-gate exposure (NR-9.6) | Session memory, cross-referenced by NR-14.5's audit doc | Fixed and live-verified per memory; not independently re-verified in this pass |
| Production + staging RLS disabled | RLS Exposure Audit | Doc's own live Security Advisor rerun: `rls_disabled_in_public: 0/0` both projects |
| P2-C legacy-manifest blob integrity | P2C_LEGACY_MANIFEST_PLATFORM_AUDIT.json | `verdict: "ALL_MATCH"`, 128/128 |
| P2-C semantic defects (depth contract, evidence specificity, gap engine, WASSCE isolation) | P2C Forensic Remediation Record | Fixed per record; focused suite 59/59 PASS, live-verified against staging |

---

## 4. Still open / missing

| # | Finding | Raised by | Severity | Current evidence |
|---|---|---|---|---|
| 1 | **CSP is report-only with `unsafe-inline`**, not enforcing | WAVE 5 A2, July engineering audit, `CONSOLIDATED_BACKLOG.md` B3 | High (removes the backstop for any future XSS-class bug) | `next.config.js` ships `Content-Security-Policy-Report-Only` only |
| 2 | **`/api/webhooks/sms-reply` has no signature verification** — answer spoofing / cost-abuse surface | WAVE 5 B1, `CONSOLIDATED_BACKLOG.md` B1 | Medium-High once live SMS quiz flow is in production use | Direct read: no auth header check anywhere in the route |
| 3 | **RLS default-deny only** — no reviewed per-table policy matrix, grant inventory, or access-path map | RLS Exposure Audit | Standing constraint, not urgent today | Audit's own "still open" section |
| 4 | **AccessibilityToggle not mounted for students** | WAVE 5 B7, `CONSOLIDATED_BACKLOG.md` B7 | Medium (equity/accessibility) | grep confirms `AccessibilityToggle` is only referenced in `TeacherShell.tsx`, never under `app/student` |
| 5 | **External penetration test never engaged** — internal review is an explicit stand-in, not equivalent | WAVE 5 C6, NR-9 deliverable 2, Internal Security Review's own caveat #1 | High for MOE trust/national launch | `docs/security/PEN_TEST_VENDOR_ENGAGEMENT.md` status unchanged: no vendor selected |
| 6 | **No completed alert drill or DB restore drill** | WAVE 5 A3/B4/B5, `CONSOLIDATED_BACKLOG.md` B4/B5 | High for incident readiness | Backlog: "No completed real alert drill evidence" / "Backup-related code is not evidence of a successful restore" |
| 7 | **k6 load proof at 1K/5K VU never actually passed** | WAVE 5 C1, NR-4/NR-5 | High — blocks NR-21 launch gate by the plan's own rule | `NATIONAL_ROLLOUT_EXECUTION_PLAN.md`: NR-4 FAIL x2, explicitly deferred on Supabase Pro budget, not fixed |
| 8 | **Resend sending domain still `"failed"`** — blocks all transactional email including the NR-9.5 safeguarding-escalation fallback email | Session memory (elevated to safety-critical 2026-07-30) | Safety-critical, not generic infra | Backlog B20: "CONFIRMED STILL BROKEN... over a month with no fix" as of last check |
| 9 | **P2-A/B/C staging/production grant-hardening script exists but has only been run dry-run** | P2-A/B/C gate-closure entries in `CURRENT_EXECUTION_STATE.md` | Low-medium (non-exploitable today, RLS already default-deny) | Doc's own words: "grants have not actually been revoked on staging or production" |
| 10 | **P2-C legacy-migration manifest byte-count drift affects 38 of 128 entries**, not the 1 originally believed | P2C Forensic Remediation Record's own correction | Low (frozen audit evidence, not live risk), but a human decision is explicitly still pending | Record: "a human decision on the full correction is still pending" |
| 11 | **`docs/internal/grading/SECURITY_AUDIT.md` was never actually written** | This synthesis | Documentation gap, not a code gap | File is a literal template placeholder since 2026-01-29 |
| 12 | **Grading-security audit content may already be covered elsewhere** (NR-14.5, Internal Security Review #2) but no single grading-specific security document exists to confirm total coverage | This synthesis | Low — likely already addressed piecemeal | Cross-reference only; not independently confirmed as a full audit |

---

## 5. Planned but not yet executed

Cross-referencing the open items above against `CONSOLIDATED_BACKLOG.md` and
`NATIONAL_ROLLOUT_EXECUTION_PLAN.md`:

**Has an explicit plan slot already:**
- CSP enforcement → folded into Doc B item B3, part of NR sequence pre-pilot set (no dedicated NR-number, but tracked)
- SMS webhook auth → Doc B item B1
- Accessibility toggle → Doc B item B7
- External pen test → NR-9 deliverable 2 (explicitly deferred, needs a funded vendor engagement, not engineering time)
- Alert/restore drills → Doc B items B4/B5, also NR-15/NR-17
- k6 load proof → NR-4/NR-5 (explicitly blocked on a Supabase Pro-tier upgrade the project currently lacks budget for)
- Resend domain → tracked in the backlog at safety-escalation priority; the fix is a DNS/account action outside engineering (whoever holds Resend/DNS access must complete domain verification)
- RLS policy matrix → the audit's own "Required discovery" and "Safe remediation gate" sections define the plan; not scheduled to a specific NR sprint

**True blind spots — no plan anywhere:**
- **P2-A/B/C grant-hardening script never actually applied.** This is not in `CONSOLIDATED_BACKLOG.md`'s tracked items at all — it only appears in `CURRENT_EXECUTION_STATE.md`'s narrative history as an "open, non-blocking follow-up." No NR sprint or backlog row owns it.
- **P2-C legacy-manifest byte-count correction (38 entries).** Explicitly flagged as needing "an explicit, separate decision" — no owner, no sprint, no backlog row.
- **`docs/internal/grading/SECURITY_AUDIT.md` being empty.** Never flagged anywhere as a gap to close; it is simply absent from every planning document's radar.
- **The P7-A/B/C program (governed measurement, controlled experiments, quality operations) is complete and certified as of 2026-09-02, but `CONSOLIDATED_BACKLOG.md` (last reconciled 2026-08-03) has no awareness of it at all.** This is a currency gap in the backlog itself, not a gap in the underlying work — but it means anyone reading only the backlog would not know this entire program exists or is done.
- **No structural fix for the recurring RBAC/tenant-scope-gap pattern (§2.1).** Every individual instance has a plan slot (it was the finding of some NR sprint), but the *pattern itself* — new routes shipping without inherited scope enforcement — has no owner or planned mitigation (e.g., a lint rule, a required-wrapper pattern, or a route-registration audit script). Gate 1 proposed this in 2026-02-26 and it was never picked up.

---

## 6. Audit coverage gaps — areas never audited

Inferred from comparing the feature inventory in the July engineering audit
and the backlog's feature-area list against what the 21 audits above
actually covered:

- **Billing/fees, HR/payroll, safeguarding case management, health/disability
  accommodations, inventory/library/transport** — the July engineering audit
  itself flags these as "Missing" features (10-20% complete), so there is
  nothing substantial to security-audit yet, but there is also no committed
  plan for when these areas *do* get built to require a security pass before
  launch.
- **AI prompt-injection / data-exfiltration defenses** — named as a P0
  priority in the July engineering audit's "Should exist, prioritized"
  section for AI capabilities, but no audit in this inventory tested for it
  directly.
- **Dependency/container/SAST/DAST scanning, CVE remediation sign-off (C8),
  secret rotation/history cleanup (C9)** — flagged VALID in
  `CONSOLIDATED_BACKLOG.md` with "no complete sign-off found"; no audit in
  this inventory actually performed this scan, only asserted its absence.
- **Load/performance under real national concurrency** — every performance
  claim in the audits above is either synthetic (`nationalScaleSmoke.test.ts`,
  explicitly called out as not equivalent to production load proof) or a
  failed real attempt (NR-4). No audit has verified real-world performance
  at anything approaching national scale.
- **The full P2-B qualified-review-operations design has a design doc
  (`P2B_QUALIFIED_REVIEW_OPERATIONS_FINAL_DESIGN.md`) but this synthesis
  found no dedicated audit of its actual implementation** — only the P2-C
  forensic remediation record's incidental confirmation that P2-B's 11
  tables are "present, unchanged" during a regression check for other work.

---

## 7. Recommendation

In rough priority order, respecting this repo's standing constraints
(`AGENT_TEACHING_RUNTIME_ENABLED` stays disabled; never weaken RBAC, tenant
isolation, audit logging, or cost controls to close any of these):

1. **Enforce the CSP** (flip `Content-Security-Policy-Report-Only` to
   `Content-Security-Policy` and remove `unsafe-inline` from `script-src`)
   once the report-only period's violation reports have been reviewed — this
   was always the stated plan (see the inline comment in `next.config.js`),
   it appears simply not to have been finished.
2. **Add signature verification to `/api/webhooks/sms-reply`**, reusing the
   `AT_WEBHOOK_SECRET`/HMAC pattern already implemented and working in
   `sms-inbound/route.ts` — this is a small, contained fix with a working
   in-repo reference implementation.
3. **Mount `AccessibilityToggle` for students**, not just teachers — the
   component exists; this is a wiring gap, not new engineering.
4. **Give the P2-A/B/C grant-hardening script and the 38-entry manifest
   byte-count correction an explicit owner and a backlog row** — both are
   fully specified, low-risk, and simply waiting for someone to say "do it."
5. **Update `CONSOLIDATED_BACKLOG.md` to reflect the P7-A/B/C program's
   completion** so it stops being the one canonical document that doesn't
   know this work happened.
6. **Treat the recurring RBAC/tenant-scope-gap pattern as its own backlog
   item**, not six separate closed findings — build the static check Gate 1
   proposed in 2026-02-26 (a lint rule or CI script that fails a new API
   route lacking an explicit scope/permission declaration) so the seventh
   instance is caught before merge, not after an audit finds it.
7. **The external pen test, load proof, and Resend domain fix all require a
   human/vendor/budget action outside engineering** — these are correctly
   already flagged as external-action items in the backlog; this synthesis
   does not change their nature, only confirms none of the three has moved.

---

## 8. Live re-verification — 2026-09-04

A follow-up pass re-checked the "Still open" and "Planned but not yet
executed" items above directly against the running repo and live production,
rather than trusting this document's own claims. Method: direct file reads,
grep, a live Resend API call, a live Supabase Security Advisor call, GitHub
Actions CI history, and a security-auditor sub-agent pass (Read/Grep-only,
partial — it hit its turn budget; the items it didn't finish were
independently re-checked directly below instead).

**Confirmed still open, unchanged, with direct evidence:**

| Item | Evidence just pulled |
|---|---|
| CSP report-only + `unsafe-inline` | `next.config.js:55-58` — still `Content-Security-Policy-Report-Only`. The file's own inline comment says the plan was to flip to enforcing "after one deploy once the report stream is clean and the two known inline scripts carry nonces" — that step was never taken. |
| `sms-reply` has no signature check | Full read of `app/api/webhooks/sms-reply/route.ts` — no auth header, no HMAC, nothing; `from`/`text` are trusted straight from the request body and can flip `score`/`status` on a real `AssignmentSubmission` via the `isLast` branch. By contrast `app/api/webhooks/sms-inbound/route.ts:39-55` does verify `x-at-signature` via HMAC-SHA256 when `AT_WEBHOOK_SECRET` is set. The asymmetry is real and current. |
| AccessibilityToggle not mounted for students | Repo-wide grep: only import/render site is `app/teacher/TeacherShell.tsx:5,44`. Nothing under `app/student`. |
| No structural RBAC/tenant-scope backstop | No custom ESLint rule, no `.github/workflows` scope check, and the only route-guard-shaped file (`lib/moe/routeGuard.ts`) is narrowly scoped to `/moe/*` page routing, not a general API tenant-scope enforcement mechanism. Gate 1's 2026-02-26 proposal is still unimplemented. |
| External pen test | `docs/security/PEN_TEST_VENDOR_ENGAGEMENT.md` — Status line still reads "NOT STARTED," last log entry 2026-08-10. |
| Resend domain | **Live API call** to `api.resend.com/domains` just now: `liberialearn.edu.lr` → `"failed"`. Still broken today, not just as of the backlog's last written check. |
| P2-A/B grant-hardening script | `CURRENT_EXECUTION_STATE.md` (current text, ~line 520-524) still reads "It has been run dry-run only; grants have not actually been revoked on staging or production." |
| `docs/internal/grading/SECURITY_AUDIT.md` never written | Still literally `<PASTE SECURITY_AUDIT.md CONTENT HERE>`. |
| `CONSOLIDATED_BACKLOG.md` stale re: P7-A/B/C | `git log` — backlog file's last commit is `fda31e4b` (2026-08-28, NR-12 closure); zero mentions of "P7-A/B/C," "governed measurement," or "quality operations" anywhere in the file. `CURRENT_EXECUTION_STATE.md` has commits as recent as `0da874a4` (2026-09-03). The gap is confirmed still open. |
| k6 load proof | No `k6`-named file anywhere in the repo outside `node_modules`. Consistent with "never actually run/passed," though absence of a file isn't proof a run never happened elsewhere. |

**Confirmed now fixed / holding, with direct live evidence (stronger than the original synthesis's evidence):**

- **Production RLS containment is holding today, not just as of 2026-08-18.** A live call to Supabase's Security Advisor (project `bnphuinpvgpmebcsvmsp`, production) returned **zero** `rls_disabled_in_public` findings. The only RLS-related lints present are 229 `rls_enabled_no_policy` (INFO level) — RLS is *on* with no policy, i.e. default-deny, which is the intended state per the containment fix. This is a materially stronger check than a doc claim: it's the live database, right now.
- **No client-exposed Supabase usage.** The only file importing Supabase server-side storage (`lib/supabaseStorage.ts`) is referenced from 10 files — all scripts, API routes (server), or tests. None are client components. The "safe today only because there's no PostgREST-exposed client" claim holds.
- Of the handful of tenant-scoped routes actually re-checked (`app/api/admin/students`, `app/api/grading/[submissionId]/override`, `app/api/moe/dashboard`), all three correctly derive scope from the session, not from client input. This is not a full sweep — several of the originally-targeted route paths (curriculum approval, students-by-id, schools-by-id, reports, agents) don't exist at the guessed paths and weren't relocated in the time available — so treat the recurring-pattern risk (§2.1) as unchanged, not cleared.
- **Test-suite health.** Local `npx tsc --noEmit` OOM-crashed on this machine (only ~1.7GB free of 8GB at the time — a known constraint, see project memory on this dev box) and is inconclusive. Real evidence instead: GitHub Actions CI on `main` is green as of the most recent merge (PR #122, three jobs — CI, Runtime Gate 1, PR Triage — all `success`, 2026-09-03T16:01 UTC). This resolves the synthesis's own flagged contradiction (§ purpose note) in CI's favor for the current `main` HEAD.

**New, not in the original synthesis — found during this pass, unverified severity, worth a look:**

- `app/api/grading/[submissionId]/override/route.ts:68` returns HTTP 500 instead of 403 whenever a `requireRole` failure's error message doesn't literally contain the substring `"Unauthorized"` — a string-match instead of a structured status code. This doesn't bypass the actual scope check a few lines above it, but it does mean some auth failures on this route won't be distinguishable from server errors in monitoring/alerting. Low-medium severity, easy fix (mirror the `err?.status` pattern already used in `app/api/admin/students/route.ts`).
- Two further leads from the security-auditor sub-agent were **not** independently confirmed in this pass and should be treated as unverified: (a) whether `app/api/moe/dashboard/route.ts`'s 15-minute Redis cache key is shared across MOE actors of different scope (only relevant if district-scoped MOE actors exist — needs a human to confirm the role model), and (b) whether request-logging middleware captures response bodies for `app/api/admin/students/route.ts`, which would put minor PII into logs.

**Not re-checked this pass:** staging Supabase RLS state specifically (only production was unambiguously identified from the three projects visible to this session's Supabase connection); the 38-entry P2-C manifest byte-count item; alert/restore drill status (no drill artifact would be visible in the repo either way).

**Bottom line:** nothing in the synthesis's "still open" list has closed since 2026-09-04's compile date, and the one open question the synthesis itself flagged (conflicting test-suite health reports) is now resolved via live CI rather than a local run. The two genuinely new items above are minor by comparison and don't change the priority order in §7.
