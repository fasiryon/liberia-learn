# DOC A — Pilot Blockers (SEVERITY: CRITICAL)

**Audit:** WAVE 5 — Comprehensive National-Rollout Readiness Audit
**Date:** 2026-06
**Scope of this doc:** Items that MUST be fixed before any external party (MOE, principals, partners) sees the VSL or touches the live platform.
**Method:** Read-only audit. No code was modified. The one finding that qualifies for emergency patch under the audit rules (A1) is a security-sensitive change to a render path that must be tested before shipping, so it is documented here with a ready-to-apply fix rather than hot-patched mid-audit.

> **⚠️ TOP HUMAN-ATTENTION ITEM:** A1 (stored XSS via the regex HTML sanitizer on teacher-authored lessons) is the single finding that, in my judgement, requires human review *before* any external party is given access to a logged-in surface. It is exploitable by any authenticated teacher account, the malicious payload fires on the **principal** during moderation preview *and* on **students** after approval, and there is no CSP as a backstop. Fix is ~0.5 day.

---

## A1 — Stored XSS via regex-based HTML sanitizer on teacher-authored lessons
- **Severity:** CRITICAL
- **Perspectives:** Security Professional, Student, School Principal
- **Files:**
  - `lib/lessons.ts:40-48` (`sanitizeLessonHtml`) and `lib/lessons.ts:50-84` (`renderSimpleMarkdown`)
  - `app/teacher/lesson/[contentId]/TeacherLessonViewClient.tsx:334` (`dangerouslySetInnerHTML={{ __html: renderedBody }}`)
  - `app/student/lessons/[id]/LessonDeliveryClient.tsx:1189` and `:425`,`:436`,`:1144`
  - `app/student/lesson/[contentId]/page.tsx:17`
  - `components/grading/EssaySubmit.tsx:215`, `components/adaptive/StuckHelper.tsx:313`
- **Description:** Teacher-authored lesson bodies (Wave 4 lesson creation) are rendered to students and principals via `dangerouslySetInnerHTML`. When content "looks like HTML," it is passed through `sanitizeLessonHtml`, a **regex-based** sanitizer. Regex HTML sanitizers are reliably bypassable. The event-handler strip at `lib/lessons.ts:44-46` requires whitespace before `on…`:
  ```js
  .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")   // requires \s before "on"
  ```
  so `<svg/onload=alert(document.cookie)>` (slash separator, no leading whitespace) survives. Entity-encoded schemes (`<a href="jav&#x09;ascript:…">`) bypass the `javascript:` filter at `:47`. There is **no DOMPurify / sanitize-html dependency** in `package.json` and **no CSP header** (see A2), so nothing else catches it.
- **Reproduce:** As a teacher, create a lesson whose body contains `<svg/onload=alert(1)>`. Open the moderation preview as a principal → script executes in the principal's session. Approve → script executes for every student who opens the lesson.
- **Acceptance criteria:** Replace `sanitizeLessonHtml` with a vetted sanitizer (`isomorphic-dompurify`, allowlist of tags/attrs matching the markdown renderer's output). Add a unit test for each known bypass vector (`<svg/onload>`, `<img/onerror>`, entity-encoded `javascript:`, `<a href=data:…>`). Ship A2 (CSP) in the same change as defense-in-depth.
- **Estimated fix time:** 0.5 day.

## A2 — No Content-Security-Policy header
- **Severity:** HIGH (escalates A1 from "containable" to "uncontained")
- **Perspectives:** Security Professional
- **Files:** `next.config.js:19-37` (sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, but **no `Content-Security-Policy`** — confirmed `grep -c "Content-Security-Policy" next.config.js` → `0`).
- **Description:** With no CSP, any HTML-injection (A1) executes with full privileges and can exfiltrate session data. A `script-src 'self'` policy would neutralise most stored-XSS payloads even if a sanitizer gap exists.
- **Acceptance criteria:** Add a CSP header in `next.config.js`. Start in `Content-Security-Policy-Report-Only` for one deploy to catch inline-script breakage (note `app/admin/credential-card/page.tsx:42` and `components/LowBandwidthModeScript.tsx:33` use inline scripts — these need nonces or hashes), then enforce.
- **Estimated fix time:** 0.5 day (including report-only shakeout).

## A3 — Verify production observability + alerting env is actually set
- **Severity:** CRITICAL (operational blindness during external demos)
- **Perspectives:** SRE/DevOps, Senior Engineer
- **Files (evidence the wiring exists):** `app/instrumentation.ts:22-23` (`SENTRY_DSN` gate), `lib/sentry.ts` (PII scrubbing via `scrubSentryEvent`), `docs/ops/ALERTS.md` (`OPS_ALERT_EMAIL`/`OPS_ALERT_PHONE`).
- **Description:** Sentry is correctly wired with PII scrubbing and is gated on `SENTRY_DSN` being present (`enabled: Boolean(dsn)` in `app/instrumentation.ts`). If `SENTRY_DSN` is unset in the Vercel production env, **errors are silently dropped**. Same for `OPS_ALERT_EMAIL` / `OPS_ALERT_PHONE` (alerts no-op without them). This is a config verification, not a code defect.
- **Acceptance criteria:** Confirm in Vercel production env that `SENTRY_DSN`, `OPS_ALERT_EMAIL`, `OPS_ALERT_PHONE`, and `SQS_DLQ_URL` are set; trigger one test error and confirm it lands in Sentry; trigger one test alert and confirm it lands in inbox/phone.
- **Estimated fix time:** 0.5 day (verification + one drill).

## A4 — Confirm committed demo credentials are not live in production
- **Severity:** CRITICAL if the account exists in prod; otherwise informational
- **Perspectives:** Security Professional, MOE Official
- **Files:** `.env.e2e` is tracked in git and contains `E2E_MOE_EMAIL=offici…` and `E2E_MOE_PASS=DemoSe…` (a real-looking MOE-role credential committed to the repo).
- **Description:** A known username/password for an MOE-role account is in version control. If a user with that email + password exists in the production database, anyone reading the repo (or a leaked clone) has MOE-official login. E2E fixtures should never double as live accounts.
- **Reproduce:** `git show HEAD:.env.e2e`; then attempt login to production with those values.
- **Acceptance criteria:** Confirm no production user matches those credentials (or rotate the password and scope the account to non-prod). Move `.env.e2e` secrets out of git history if the account is/was live.
- **Estimated fix time:** 0.5 day.

## A5 — Confirm production migration state is clean (no recorded-but-unapplied drift)
- **Severity:** CRITICAL (data-integrity / silent feature breakage)
- **Perspectives:** SRE/DevOps, MOE Official
- **Files:** `app/api/health/route.ts:41-61` (`checkMigrations` returns `pending` when `_prisma_migrations` has unfinished rows). Prior session memory flags a "recorded-but-unapplied migration landmine."
- **Description:** The health endpoint already detects migration drift. Before external exposure, confirm `GET /api/health` returns `checks.migrations: "ok"` in production. A `pending` here means a migration is recorded but not applied, which can cause runtime errors on routes that assume the new schema.
- **Acceptance criteria:** `curl https://<prod>/api/health` → `checks.migrations === "ok"`. If `pending`, run `npx prisma migrate deploy` against prod and re-verify.
- **Estimated fix time:** 0.5 day (or longer if a drift is found and must be reconciled).

## A6 — Dependency CVE triage (run `npm audit fix`)
- **Severity:** MEDIUM (none confirmed production-exploitable; included here because the fix is fast and pre-external hygiene)
- **Perspectives:** Senior Engineer, Security Professional
- **Evidence:** `npm audit` → **42 vulnerabilities (1 critical, 21 high, 18 moderate, 2 low)**. The lone *critical* is `vitest` UI server arbitrary file read/exec (GHSA-5xrq-8626-4rwp) — a **devDependency**, not production-reachable. Most *high* items (esbuild dev-server file read GHSA-g7r4-m6w7-qqqr) are also dev-only. The production-relevant ones are transitive `axios` SSRF / prototype-pollution (GHSA-m7pr-hjqh-92cm, GHSA-q8qp-cvcw-x6jj). `axios` is **not a direct dependency** (transitive), so reachability depends on which SDK pulls it.
- **Acceptance criteria:** Run `npm audit fix` (non-breaking), re-run, and triage the residual. Confirm whether any runtime code path passes attacker-controlled URLs to a transitive `axios` (SSRF). Re-state counts after the fix.
- **Estimated fix time:** 0.5 day.

---

### Doc A total: 6 items · estimated 1–3 days (A1+A2 are the real engineering work; A3–A6 are verifications + a dependency bump)
