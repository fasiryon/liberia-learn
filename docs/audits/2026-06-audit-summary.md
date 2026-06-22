# DOC D — WAVE 5 Audit Summary

**Audit:** WAVE 5 — Comprehensive National-Rollout Readiness Audit
**Date:** 2026-06 (conducted 2026-06-22)
**Companion docs:** [Doc A — Pilot Blockers](./2026-06-pilot-blockers.md) · [Doc B — Pre-Pilot Blockers](./2026-06-pre-pilot-blockers.md) · [Doc C — National Rollout Roadmap](./2026-06-national-rollout-roadmap.md)

---

## Executive summary

LiberiaLearn is, on its engineering fundamentals, in strong shape for a first pilot. The full test suite passes end-to-end (**421 files / 3,529 tests**), `tsc --noEmit` is clean (0 errors), all **21 cron jobs enforce `CRON_SECRET`**, there are **0 `console.log` calls in route handlers**, **no hardcoded secrets** in source, Sentry is wired with proper PII scrubbing, audit logs are DB-trigger-immutable, security headers (HSTS / X-Frame-Options / nosniff) are set, login is rate-limited, uploads are size/MIME-validated, and the RBAC story is mature (453 of 508 API routes carry an explicit auth check; the remaining 55 → 28-after-correction are legitimately public surfaces: auth, health, registration, webhooks, and token-gated share links). This is a real, well-tested platform, not a prototype.

The blocking issues are narrow and fixable. Exactly one finding rises to "fix before any external party sees a logged-in surface": a **stored-XSS hole in the regex-based HTML sanitizer** (`lib/lessons.ts`) that renders teacher-authored lesson content to students and to principals during moderation, with **no CSP** as a backstop. Everything else in Doc A is a fast verification (production env vars, committed demo credentials, migration state, dependency triage). The pre-pilot set (Doc B) is dominated by *operational proof* gaps — alert drills and DB restores that were configured but never actually exercised — plus accessibility delivery (the large-font toggle exists but isn't mounted for students) and audio narration coverage (~6%).

The national-rollout work (Doc C) is genuine but ordinary scale-up engineering: load testing at 1.5M students (the current load test fails at 1,000 VUs, partly a test artifact, partly free-tier limits), data-residency/clean-exit attestations for the MOE, a third-party pen test, a full WCAG audit, and SMS/AI cost controls at volume. None of it is architectural rework.

## Top 5 critical findings

1. **Stored XSS via regex HTML sanitizer** on teacher lessons — exploitable by any teacher account, fires on principals (moderation preview) and students (`lib/lessons.ts:40-48`). *(Doc A1)*
2. **No Content-Security-Policy header** — removes the backstop that would contain #1 (`next.config.js:19-37`, CSP count = 0). *(Doc A2)*
3. **Operational alerting/restore are unproven** — alert drill logs are empty and no DB restore has been test-run; the platform may be flying blind in an incident (`docs/ops/ALERTS.md`). *(Doc A3 / B4 / B5)*
4. **Accessibility + audio access gaps** — large-font toggle not mounted for students; audio narration at ~6% coverage — the platform is largely inaccessible to low-vision and non-reading students. *(Doc B7 / B8)*
5. **Unauthenticated inbound SMS webhook** — no signature/secret; enables answer spoofing and (once live SMS is on) outbound-SMS cost abuse (`app/api/webhooks/sms-reply/route.ts`). *(Doc B1)*

## Findings by perspective

| # | Perspective | Findings | Notable |
|---|-------------|----------|---------|
| 1 | Senior Software Engineer | 7 | Tests/tsc/crons/secrets all strong; CVE triage, CI gates, drift check |
| 2 | Security Professional | 11 | XSS (A1), CSP (A2), SMS webhook (B1), IP rate-limit (B2), tenant-isolation matrix (C5), pen test (C6) |
| 3 | SRE / DevOps | 9 | Alert drills (B4), restore drill (B5), cron freshness (B6), load test (C1), rollback rehearsal (C41) |
| 4 | MOE Official | 8 | Data residency (C10), clean-exit (C11), reporting parity (C12), legal mapping (C14), audit coverage (C13) |
| 5 | School Principal | 5 | Moderation SLA (B13), bulk actions (C23), SMS visibility (C24), teacher audit (C25) |
| 6 | Teacher | 6 | At-risk drill-down (B14), undo (B15), Today perf (B19), preview fidelity (C28), no-ID UX (C27) |
| 7 | Student | 7 | Audio (B8), quality gate (B9), low-bandwidth (C20), offline budget (C21), shaming audit (C36) |
| 8 | Guardian / Parent | 6 | SMS cost (B10), erasure (B11), multi-child dedup (B12), encoding (C30), family access (C31) |
| 9 | Student with Disability | 6 | A11y toggle (B7), WCAG (C15), keyboard labs (C16), full audio (C17), accommodations (C18) |
| 10 | New User | 5 | Forgot-password E2E (B16), empty states (B17), orientation (C43), help (C44), onboarding scale (C45) |

(Findings are counted by primary perspective; several are cross-listed. Totals across docs: A=6, B=19, C=45 = **70 findings**.)

## Cross-reference: previous audit (16 items)

> The previous 16-item audit was not committed as a file in `docs/`; this table is reconstructed from the categories and inline references in the WAVE 5 brief. Status reflects evidence gathered this audit.

| # | Category (prev audit) | Status | Evidence |
|---|-----------------------|--------|----------|
| 1 | Security — AuthZ/RBAC | ✅ **FIXED** | NR-8 `assertPermission` rollout; 453/508 routes authed; permission catalog |
| 2 | Security — audit-log immutability | ✅ **FIXED** | NR-9 DB triggers `prevent_audit_update/delete` |
| 3 | Security — secrets / signed URLs | ⚠️ **MOSTLY FIXED** | `timingSafeEqual` in share/live tokens; no hardcoded keys; **but** `.env.e2e` demo creds committed (A4) |
| 4 | AI/safety — grounding | ✅ **FIXED** | NR-13 hybrid RAG + grounded answer service |
| 5 | AI/safety — tutor moderation | 🔶 **STILL OPEN** | Input/output moderation for minors not verified (C33) |
| 6 | AI/safety — cost controls | ⚠️ **PARTIAL** | `check-ai-budget` cron exists (NR-15); re-baseline for national (C34) |
| 7 | (inferred) error handling / boundaries | ⚠️ **MOSTLY FIXED** | Root + 5 segment error boundaries; moe/guardian missing (B18) |
| 8 | (inferred) content routing / quality gate | ⚠️ **PARTIAL** | NR-10 approved-only routing; no serve-time quality gate (B9) |
| 9 | (inferred) offline reliability | ✅ **FIXED** | NR-14A idempotent offline submission + conflict-resolution doc |
| 10 | Ops — alerting built | ✅ **FIXED** | NR-15 alert catalog + crons |
| 11 | Ops — alert delivery configured | ⚠️ **VERIFY** | Needs prod env confirm (A3) |
| 12 | Ops — SMS digest cost tracking | 🔶 **PARTIAL** | `SMSDeliveryLog` tracks delivery but **no cost field** (B10) |
| 13 | Test coverage — breadth | ✅ **FIXED** | 3,529 tests / 421 files passing |
| 14 | Test coverage — runs end-to-end | ✅ **FIXED** | Verified full-suite run (not just per-file) this audit |
| 15 | Competitive / feature parity | ➖ **N/A this audit** | Out of scope for readiness gate |
| 16 | Accessibility — font size | 🔶 **PARTIAL/REGRESSED** | `AccessibilityToggle` built but **not mounted for students** + flag-gated (B7) |
| — | **NEW (this audit)** | 🆕 | **Stored XSS via regex sanitizer (A1)** + **no CSP (A2)** — not in prior audit |

Legend: ✅ fixed · ⚠️ mostly fixed / verify · 🔶 partial / still open · ➖ out of scope · 🆕 new

## Recommended fix-sprint plan

**Sprint 5A — "Before VSL" (1–3 days, gates external outreach)**
Doc A only. Sequence: A1 + A2 together (XSS sanitizer + CSP, with bypass tests) → A4 (demo-cred check) → A5 (migration state) → A3 (prod observability verify + one drill) → A6 (`npm audit fix`).

**Sprint 5B — "Before first pilot" (~1 week)**
Doc B. Bundle by theme: *Security* (B1, B2, B3) → *Ops proof* (B4, B5, B6) → *Access* (B7, B8, B9) → *Guardian/data* (B10, B11, B12) → *Workflow/UX* (B13–B19). B5 (restore drill) and B8 (audio) have the longest lead times — start them first.

**Sprint 5C — "Before national contract" (2–4 weeks + external lead times)**
Doc C, T1 first. Kick off the long-pole / external items on day 1 (C6 pen test, C14 legal review, C1 load test, C17 audio) since they run in parallel calendar time; do the in-house T1 engineering (C4, C5, C10–C13, C15, C33, C29, C40) alongside; defer T2/T3 to phased rollout.

---

## Final assessment (also delivered verbally to the requester)

**Is the platform ready for first-pilot *outreach* right now, with only Doc A fixes? — Yes, conditionally.** Doc A is small (6 items, ~1–3 days) and the only true engineering item is the XSS sanitizer + CSP. Once A1/A2 are fixed and tested and A3–A5 are verified, the platform is safe to demo to external stakeholders. The VSL itself (a homepage video) exposes nothing; the risk is purely in giving an external party a logged-in surface, which A1 closes.

**Realistic timeline for A + B + C, in priority order:** Doc A in **week 1**. Doc B across **weeks 2–3** (one focused week of work, but B5/B8 lead times push the tail to ~week 3). Doc C T1 across **weeks 3–7**, with the external pen test (C6) and legal review (C14) running as parallel calendar items that may extend to **week 8**; T2/T3 fold into the phased rollout thereafter. **Net: ~6–8 weeks of calendar time to be national-contract-ready, of which ~3–4 weeks is in-house engineering effort.**

**Single item requiring human attention before any external party sees a logged-in surface:** **Doc A1 — stored XSS via the regex HTML sanitizer in `lib/lessons.ts`.** It is exploitable by any teacher account, the payload executes in the *principal's* session during moderation preview (before approval) and in every *student's* session after approval, and there is currently no CSP to contain it. This was deliberately not hot-patched during the read-only audit because it touches a security-sensitive render path and adding a sanitizer dependency must be tested — but it should be the first thing fixed.
