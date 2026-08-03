# Curriculum Risk-Triage Design

**Date:** 2026-08-03
**Status:** Approved for planning
**Related:** NR-11 (MOE Published Backlog Approval — reframed), feeds NR-12 (Critical Grade Deserts, G2/G9)

## Context

NR-11 found that roughly 95% of live curriculum content in production was approved by
standalone scripts (`scripts/bulk-approve-published.ts`,
`scripts/promote-enriched-lessons.ts`) checking word count, content length, and
placeholder titles only — no human or MOE review, and no audit trail (712 of 1,089
`APPROVED`/`published` rows have no approver identity at all; `AuditLog` shows only 41
audited human approval actions in the project's history).

NR-12 (Critical Grade Deserts) is about to generate the first-ever content for Grade 2
and Grade 9 across multiple subjects — exactly the highest-stakes case for this gap:
young children, foundational content, no existing baseline to compare against.

This design defines a risk-based triage layer that keeps the existing mechanical
quality gate for objective checks, but routes the highest-risk subset of
automatically-generated content to a real human/MOE reviewer instead of silently
auto-approving everything, while keeping the reviewer's weekly workload bounded and
realistic.

## Goals

- Stay as autonomous as today for the bulk of content — most lessons should still
  auto-approve with no human involved.
- Route the highest-risk lessons (young grades, sensitive subjects, first-of-kind
  content, borderline quality-gate passes) to a real reviewer instead.
- Never overwhelm the reviewer: cap flagged volume to a realistic weekly budget
  (5-10 lessons/week), enforced platform-wide, not just per generation run.
- Make every automated approval decision — auto-approved or flagged — traceable for
  the first time (risk score, reasons, audit log entry), unlike the current scripts.
- Become the permanent, platform-wide replacement for how future automated curriculum
  generation gets approved, not a one-off for NR-12.
- Notify reviewers (email + in-app) when something needs their attention.

## Non-goals

- Re-reviewing the ~1,000+ lessons already live in production (out of scope, a
  separate decision if ever made).
- An AI/semantic quality check (tone, factual accuracy, cultural appropriateness).
  Explicitly deferred — v1 is rule-based only, using signals already available
  (grade, subject, first-of-kind, quality-gate margin).
- Any change to the human-driven approve/reject routes
  (`app/api/admin/curriculum/approve/route.ts`,
  `app/api/admin/curriculum/reject/route.ts`,
  `app/api/admin/ops/curriculum-review/route.ts`). A human clicking Approve already
  is the review; triage only intercepts automated/script-driven status transitions.
- Building approve/reject UI buttons on `/admin/ops/curriculum-review` (still a known,
  separate follow-up from NR-11).
- Schema changes. Everything here reuses existing `CurriculumContent.status` values
  (`NEEDS_REVIEW` is already fail-closed, confirmed in NR-10) and the `payload` JSON
  column for metadata, matching the existing convention used by the approve routes.

## Architecture

A new module, `lib/curriculum/riskTriage.ts`, sits between "content passed the
existing mechanical quality gate" (`validateRegeneratedLesson` /
`evaluatePromotionCandidate`) and "content gets a final status." It is called only
from automated/script-driven paths, never from human-driven approve/reject routes.

### `computeRiskScore(candidate): { score: number; reasons: string[] }`

Pure, deterministic, no I/O. Additive scoring from:

- **Grade band:** G1-3 highest risk, G4-6 moderate, G7+ baseline (subject-driven only).
- **Subject sensitivity:** `CIVICS`, `SOCIAL_STUDIES`, `HEALTH` scored higher risk;
  `MATH`, `SCIENCE`, `ENGLISH`, `LITERACY`, `ENGINEERING`, `COMPUTER_SCIENCE` baseline.
- **First-of-kind cell:** no existing `APPROVED`/`published` content yet for this
  grade × subject combination (queried against `CurriculumContent`, the same shape of
  query the coverage matrix already runs).
- **Quality-gate margin:** how close the candidate came to the gate's minimums (word
  count, section count) — barely passing scores higher risk than comfortably passing.

Each factor's exact weight is a small tunable table, not a fixed formula worth
hardcoding into prose here — final weights get set in the implementation plan and
should be easy to adjust without a schema or API change.

### `triageAndApprove(candidate, actor): Promise<TriageResult>`

The orchestrating function scripts call instead of directly writing
`status: "published"`.

1. Computes `riskScore` and `reasons` via `computeRiskScore`.
2. Checks the rolling 7-day review budget (see below).
3. If under budget and the candidate is above a minimal "worth flagging" floor:
   sets `status: "NEEDS_REVIEW"`, stamps `payload.riskFlagged = true`,
   `payload.riskScore`, `payload.riskReasons`, `payload.flaggedAt`; writes an audit
   log entry (`curriculum.risk.flagged`); fires a notification (best-effort).
4. Otherwise: auto-approves as today (`status: "published"`), but now also stamps
   `payload.riskScore`/`payload.riskReasons` and writes an audit log entry
   (`curriculum.risk.autoapproved`) — making even the auto-approved path traceable
   for the first time.

### Budget tracking

No new table. "Used budget" is a live count of `CurriculumContent` rows with
`payload.riskFlagged = true` and `updatedAt` within the trailing 7 days. This reuses
the existing "store metadata in payload" convention (matching `approvedByUserId`,
`bulkApproved`, etc. in the current approve routes) instead of adding schema.

The budget is a **global, platform-wide** cap, not per generation run or per script —
this is the reason Approach 2 (global rolling budget) was chosen over a simpler
per-batch cap: a per-batch cap only protects the reviewer if exactly one pipeline
generates content per week, which will not remain true once this becomes the
permanent, platform-wide approval path.

### Notifications

Reuses the existing `sendEmail()` (Resend-backed, `lib/email.ts`) with a new email
type. Recipients: every user whose role holds `PERMISSIONS.CURRICULUM_APPROVE`
(queried live via `hasPermission`/`ROLE_PERMISSIONS`, not a hardcoded contact — so
`ADMIN`, `MOE_OFFICIAL`, `MOE_SUPER_ADMIN`, and any future role granted the
permission are covered automatically). Plus a small "N lessons awaiting your review"
count added to the existing `/admin/ops/curriculum-review` page (a live query against
`NEEDS_REVIEW` rows with `riskFlagged = true`, no new state).

## Data flow

1. A generation pipeline (NR-12's new script, or an existing one going forward)
   produces a candidate lesson and runs the existing mechanical quality gate.
   Fails → unchanged behavior (stays `DRAFT`/rejected).
2. Passes → calls `triageAndApprove()`.
3. `triageAndApprove` scores the candidate and checks this week's flagged count
   against the budget.
4. Under budget + flagged as risky → `NEEDS_REVIEW`, audit-logged, notification sent.
5. Otherwise → auto-approves as today, but now audit-logged and risk-stamped.
6. A reviewer opens `/admin/ops/curriculum-review` (MOE-accessible per NR-11),
   sees the flagged item, approves/rejects via the existing (unchanged) route.

## Error handling

- **Notification failures** (email provider down) never block the approval/flagging
  decision — logged as a warning, matching the existing best-effort pattern already
  used for RAG sync and embeddings in the approve routes.
- **Budget-check failures** (e.g. a DB read error while counting the trailing-7-day
  flagged rows) fail closed: default to flagging for review rather than silently
  auto-approving blind. Wrong-but-safe costs a reviewer a few minutes; wrong-but-unsafe
  means unreviewed content reaches students.
- **Concurrent budget races:** two generation pipelines running at the same moment
  could both read the same "budget remaining" count and both flag, slightly
  overshooting the weekly cap. Accepted as a minor risk given current usage is
  occasional manual script runs, not high-frequency concurrent automation — a
  deliberate call, not an oversight, worth revisiting if real concurrent pipelines
  are ever built.

## Testing

- Table-driven unit tests for `computeRiskScore` covering every combination of grade
  band, subject sensitivity, first-of-kind, and gate-margin.
- Unit tests for the budget check at zero remaining, mid-budget, and exhausted.
- Integration-style tests for `triageAndApprove`: passes gate + low risk → auto-
  approve; passes gate + high risk + budget available → `NEEDS_REVIEW` + notification
  fires; high risk + budget exhausted → auto-approves anyway with a logged warning.
- A regression test confirming the human-driven approve/reject routes are completely
  untouched — triage only ever intercepts automated/script paths.

## Open items carried to the implementation plan

- Exact numeric weights for each risk factor (grade band, subject, first-of-kind,
  gate margin) and the minimal "worth flagging" floor.
- Exact weekly budget number (5-10/week was the stated realistic range; implementation
  should make this a single easily-adjustable constant, not hardcoded in multiple
  places).
- Which existing scripts get migrated onto `triageAndApprove` first
  (`bulk-approve-published.ts`, `promote-enriched-lessons.ts`) versus which are
  addressed only when NR-12's new generation path is built.
