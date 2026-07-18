# DOC B — Pre-Pilot Blockers

**Audit:** WAVE 5 — Comprehensive National-Rollout Readiness Audit
**Date:** 2026-06
**Scope of this doc:** Items that block running a first real pilot at one school (100–300 students) but do **not** block VSL outreach itself. (VSL outreach is gated only by Doc A.)
**Severity legend:** these are mostly HIGH/MEDIUM. Format matches Doc A.

---

## SECURITY

### B1 — Unauthenticated inbound SMS webhook (spoofing + outbound-SMS cost abuse)
- **Severity:** HIGH (currently mitigated by live-SMS flag being off → dry-run)
- **Perspectives:** Security, Guardian, SRE
- **Files:** `app/api/webhooks/sms-reply/route.ts:26-53` — accepts `from`/`text` with **no signature or shared-secret check** (confirmed: `grep -nE "SECRET|signature|verify|hmac|401|403"` → no matches). It looks up an `smsSession` by `from` and, on a quiz flow, calls `sendSMS` (`lib/sms.ts`).
- **Description:** An attacker can POST arbitrary `from` (phone number) + `text` to (a) submit quiz answers as any guardian/student → corrupts assessment data, and (b) cause outbound SMS to attacker-chosen numbers → cost abuse / spam. Not currently exploitable for cost because `isLiveSmsEnabled()` routes to `DryRunSMSProvider` (`lib/sms.ts:8`), but the moment live SMS is enabled for the pilot this is open.
- **Acceptance criteria:** Verify the request originates from Africa's Talking (shared-secret in the callback URL path, IP allowlist, or provider signature). Rate-limit per `from`. Add a test.
- **Estimated fix time:** 0.5 day.

### B2 — Login rate-limit is per-identifier only, not per-IP
- **Severity:** MEDIUM
- **Perspectives:** Security
- **Files:** `lib/auth.ts:97-102` — `checkRateLimit(`credentials:${identifier}`…)`. Keyed on the submitted identifier, so credential-stuffing across many usernames from one IP is not throttled.
- **Acceptance criteria:** Add a per-IP limiter alongside the per-identifier one. Test both dimensions.
- **Estimated fix time:** 0.5 day.

### B3 — CSP enforcement shakeout (follow-on to A2)
- **Severity:** MEDIUM
- **Perspectives:** Security
- **Description:** A2 ships CSP in report-only before VSL. Before the pilot, move to enforcing mode and resolve the two known inline scripts (`app/admin/credential-card/page.tsx:42`, `components/LowBandwidthModeScript.tsx:33`) with nonces/hashes.
- **Estimated fix time:** 0.5 day.

## OPERATIONS / SRE

### B4 — Alert drills have never been run (paper drills only)
- **Severity:** HIGH
- **Perspectives:** SRE/DevOps
- **Files:** `docs/ops/ALERTS.md` — every "Drill log" section is empty; the pre-pilot checklist line `- [ ] Drilled each alert at least once` is **unchecked**, and the catalog explicitly lists `Untested — alert expected but not drilled before pilot`.
- **Description:** The alert system (NR-15: AI-budget, DLQ, etc.) is built but no alert has been confirmed to actually fire end-to-end to a human. This is prior-audit items 10–12, still open.
- **Acceptance criteria:** Execute each drill in `ALERTS.md`, record timestamp + who received it in the drill-log tables, check the box.
- **Estimated fix time:** 1 day.

### B5 — Database restore has not been test-restored
- **Severity:** HIGH
- **Perspectives:** SRE/DevOps, MOE Official
- **Description:** No evidence in `docs/ops/` of an actual restore drill (backup *configured* ≠ restore *verified*). For student records this is non-negotiable before a pilot.
- **Acceptance criteria:** Perform a point-in-time restore of the production DB into a scratch project, verify row counts and a sample student's data, document the runbook with real timings.
- **Estimated fix time:** 1 day.

### B6 — Cron last-run freshness not monitored
- **Severity:** MEDIUM
- **Perspectives:** SRE/DevOps
- **Evidence:** 21 cron routes exist and **all 21 enforce `CRON_SECRET`** (verified) — good. But there is no monitor that alerts when a cron *stops* firing. Prior session memory already flags `refresh-demo-schedule` as silently not firing.
- **Acceptance criteria:** Record `lastRunAt` per cron and alert if a cron misses its window (the `/api/health` or ops panel can surface this).
- **Estimated fix time:** 0.5 day.

## STUDENT / ACCESSIBILITY

### B7 — Accessibility (large-font) toggle is not available to students
- **Severity:** HIGH
- **Perspectives:** Student, Student with Disability
- **Files:** `components/AccessibilityToggle.tsx` is mounted only in `app/teacher/TeacherShell.tsx` (confirmed: not present in any `app/student/*` shell). It is also gated behind `NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE`.
- **Description:** The large-font / simplified-density mode exists and works, but the population that most needs it (low-vision students on small Android screens) cannot reach it. This is prior-audit item #16 — built but not delivered to students.
- **Acceptance criteria:** Mount `AccessibilityToggle` in the student shell; enable the flag for the pilot; verify the `data-a11y` CSS rules scale lesson text.
- **Estimated fix time:** 0.5 day.

### B8 — Audio narration coverage is far below usable threshold
- **Severity:** HIGH
- **Perspectives:** Student with Disability, Student
- **Evidence:** Last measured baseline (NR-14, `docs/ops/NR14_AUDIO_PIPELINE.md`): **284 / 4,856 lessons (6%) overall**, Priority-1 (MATH/SCIENCE/LITERACY G1–G6) **131 / 938 (14%)**. The pipeline was blocked on `SUPABASE_SERVICE_ROLE_KEY` and an ElevenLabs permission/quota issue.
- **Description:** For non-readers, ESL students, and visually-impaired students, audio is the access path. 6% coverage means the feature effectively doesn't exist for most lessons. **Re-measure** before the pilot — the number is stale.
- **Acceptance criteria:** Re-run `scripts/audio-coverage-audit.ts`; get Priority-1 to the ≥50% gate before the pilot; unblock the ElevenLabs/Supabase credentials.
- **Estimated fix time:** depends on TTS throughput; budget 2–3 days of pipeline runs.

### B9 — Lesson quality consistency is not gate-enforced at serve time
- **Severity:** MEDIUM
- **Perspectives:** Student, Teacher
- **Evidence:** Content routing filters on `status in ["published","APPROVED"]` (NR-10) but there is no min-word-count / min-slide-count gate enforced when a lesson is served. Memory notes a large NEEDS_REVIEW backlog historically.
- **Acceptance criteria:** Confirm every lesson scheduled to the pilot grade meets a minimum quality bar (word count, slide count, has assessment). Spot-check the pilot school's actual timetable.
- **Estimated fix time:** 1 day (verification + any backfill).

## GUARDIAN / DATA

### B10 — SMS spend is not tracked per-message (no cost accounting)
- **Severity:** MEDIUM (HIGH at scale)
- **Perspectives:** Guardian, MOE Official, SRE
- **Files:** `prisma/schema.prisma` `model SMSDeliveryLog` (line ~1478) logs `status`, `attempts`, `provider`, `providerMessageId` but has **no `cost` field**. There is an AI-budget cron but no SMS-budget equivalent.
- **Description:** Delivery is logged; spend is not. You cannot answer "how much did SMS cost this week" from the data model. This is prior-audit item #12 — partially addressed (delivery logging exists) but the cost dimension is missing.
- **Acceptance criteria:** Add a `costUnits`/`costUSD` column populated from the provider response; add a daily SMS-spend rollup + budget alert mirroring the AI-budget cron.
- **Estimated fix time:** 1 day.

### B11 — Guardian-facing data-deletion (right to erasure) is not exposed
- **Severity:** MEDIUM
- **Perspectives:** Guardian, MOE Official
- **Files:** Anonymization exists (`lib/exports/anonymize.ts`, `lib/privacy/anonymizeForAI.ts`) but there is no guardian-initiated "delete my child's data" path.
- **Acceptance criteria:** Document the erasure process (even if manual/admin-mediated for the pilot) and confirm it actually removes/anonymizes the child's PII across tables.
- **Estimated fix time:** 1 day (manual process doc for pilot; full self-service is Doc C).

### B12 — Multi-child guardian digest dedup not verified
- **Severity:** MEDIUM
- **Perspectives:** Guardian
- **Files:** `lib/notifications/guardianDigest.ts`. The brief requires one digest covering all children, not N digests.
- **Acceptance criteria:** Write/confirm a test that a guardian with 2+ children receives exactly one weekly digest covering all of them.
- **Estimated fix time:** 0.5 day.

## TEACHER / PRINCIPAL

### B13 — Moderation queue SLA visibility (oldest-pending age, trend)
- **Severity:** MEDIUM
- **Perspectives:** School Principal
- **Description:** Wave 4 moderation works (review, emergency-unpublish, flag escalation verified). Missing: the principal cannot see "oldest pending item age" or queue-size trend, so backlog can grow invisibly.
- **Acceptance criteria:** Surface oldest-pending age + count on the moderation page.
- **Estimated fix time:** 0.5 day.

### B14 — Teacher "at-risk" indicator drill-down
- **Severity:** MEDIUM
- **Perspectives:** Teacher
- **Description:** Verify the at-risk indicator on the teacher dashboard is clickable through to the specific students (actionable, not just a number).
- **Acceptance criteria:** Clicking the indicator lists the named at-risk students.
- **Estimated fix time:** 0.5 day (verify; build if missing).

### B15 — Teacher self-service undo for misassignment
- **Severity:** MEDIUM
- **Perspectives:** Teacher
- **Description:** Confirm a teacher can revert an accidental class/lesson assignment without admin help.
- **Acceptance criteria:** Documented or built unassign path in the teacher UI.
- **Estimated fix time:** 0.5 day.

## NEW-USER / ONBOARDING

### B16 — Forgot-password flow end-to-end verification
- **Severity:** MEDIUM
- **Perspectives:** New User
- **Files:** `app/api/auth/forgot-password/route.ts`, `reset-password/route.ts`, `reset-with-code/route.ts` (all rate-limited — good). Needs a live end-to-end test (request → email/SMS → reset → login).
- **Acceptance criteria:** Manual run-through on a staging account; confirm the email/SMS actually arrives.
- **Estimated fix time:** 0.5 day.

### B17 — Empty-state and error-message quality pass
- **Severity:** MEDIUM
- **Perspectives:** New User, Student
- **Description:** Spot-check empty states (no lessons, no certificates) and API error messages explain *what to do next*, not just *what failed*. `TrueEmptyState` was improved in NR-10; extend the pass to certificates/homework/league empties.
- **Acceptance criteria:** Each major empty state has an explanatory, next-step message.
- **Estimated fix time:** 1 day.

### B18 — Segment error boundaries for MOE and Guardian
- **Severity:** LOW
- **Perspectives:** MOE Official, Guardian
- **Files:** Error boundaries exist for `app/error.tsx` (root, catches all), `admin`, `student`, `teacher`, `platform`, plus `global-error.tsx`. `app/moe/error.tsx` and `app/guardian/error.tsx` are **missing** — these segments fall back to the root boundary (functional, just less tailored).
- **Acceptance criteria:** Add segment error boundaries for `moe` and `guardian`.
- **Estimated fix time:** 0.5 day.

### B19 — Teacher Today page performance on low-end Android / 3G
- **Severity:** MEDIUM
- **Perspectives:** Teacher, Student
- **Description:** The brief's bar is <3s on a low-end Android over 3G. There is a cold-start shield + last-known-good snapshot (recent commits) but no measured number on representative hardware/network.
- **Acceptance criteria:** Measure with a throttled profile (Moto-G-class, Slow 3G); record the number; optimize if >3s.
- **Estimated fix time:** 1 day.

---

### B20 — Verify Resend sending domain
- **Severity:** HIGH (blocks all transactional email)
- **Perspectives:** SRE/DevOps, Guardian
- **Source:** WAVE 5A / A3 (deferred from Sprint 5A, 2026-06-25)
- **Description:** Verify Resend sending domain. Current state: API key is set in Vercel production but no domain is verified. Either verify liberialearn.edu.lr (already added, failed DNS) or verify a Resend subdomain (e.g. veemalo.resend.app). Once verified, set EMAIL_FROM in Vercel, redeploy, and confirm alert email delivery to liberialearn52@gmail.com. Estimated: 30-60 min once DNS access is available. Also enables guardian digest email delivery.
- **Estimated fix time:** 30–60 min (once DNS access is available).

### B21 — Twilio trial account limitations block real guardian SMS at pilot scale
- **Severity:** HIGH (blocks real-family guardian SMS)
- **Perspectives:** Guardian, SRE/DevOps
- **Source:** Sprint 6.1 / Orange Liberia integration production wiring (2026-07-15)
- **Description:** `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_PHONE_NUMBER` are now set in Vercel production, but on a Twilio **trial** account — every outbound message is prefixed with a "trial account" notice and can only be sent to individually pre-verified numbers in the Twilio console. Sufficient for internal testing (echo agent, cron verification, manual end-to-end SMS to the developer's own verified number) but cannot reach real, unverified guardian phone numbers at pilot scale. Requires upgrading to either (1) a paid Twilio account (removes trial restrictions and the message prefix, allows sending to any number), or (2) a different provider with confirmed real Liberia coverage. This is independent of the Orange/Twilio architecture decision (Orange remains outbound-only/digest; Twilio remains the two-way conversational provider) — the blocker is account tier, not provider choice.
- **Acceptance criteria:** `AGENT_GUARDIAN_ENABLED` must not go live with real families until the Twilio account is upgraded off the trial tier (or a confirmed-coverage alternative is in place).
- **Estimated fix time:** Twilio account upgrade is a billing/verification action, not code (est. <1 hour once approved); no code change required.

### B22 — Onboarding wizard never schedules a school's first lesson
- **Severity:** MEDIUM (a fully onboarded school still looks broken to its first teacher)
- **Perspectives:** Teacher, Admin
- **Source:** Sprint 6.5 Deliverable 1 real walkthrough (2026-07-17)
- **Description:** Nothing in the 5-step admin onboarding wizard (`/admin/onboarding`) ever creates a `ScheduledWork` row. A school that completes every step (profile, teachers, students, timetable, go-live) still shows each teacher "0 lessons today" on first login, because scheduling a lesson is a separate, undiscoverable action nowhere referenced by the wizard. Step 5's own readiness checklist item "First lesson delivery verified" is hardcoded `done: false` in `app/admin/onboarding/page.tsx` and can never turn green, regardless of real state. This is a real product gap (the wizard needs a step or a nudge that gets a first lesson on the calendar), not a quick bug fix, and was explicitly scoped out of Sprint 6.5 Deliverable 2 to stay within the sprint's per-deliverable time cap.
- **Acceptance criteria:** Either the wizard's timetable step (Step 4) creates at least one real `ScheduledWork` row per class, or Step 5's checklist computes "first lesson delivered" from real data and clearly directs the admin to schedule one before declaring onboarding complete.
- **Estimated fix time:** Not scoped; likely a half-day to one-day product/UX task for a future sprint (wizard flow design + ScheduledWork creation + Step 5 checklist wiring).

---

### Doc B total: 22 items · estimated ~1 week
