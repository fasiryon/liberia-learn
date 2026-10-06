# NR-15 Alert Catalog

> Historical provider-specific catalog. The unified NR-15 alert model is now
> defined in `lib/ops/operationalAlerts.ts` and documented in
> `docs/ops/NR15_OPERATIONAL_READINESS.md`. External delivery is not certified:
> the typed adapter is intentionally no-op, and the historical email path has
> no verified sending domain. Entries below are operational setup guidance and
> historical drill evidence, not a claim that current paging works.

Each alert has a trigger, a recipient, and a "what to do when it fires" note.
All alerts land in **OPS_ALERT_EMAIL** (set this in Vercel env vars before pilot).
Alerts 1 and 5 should also go to **OPS_ALERT_PHONE** (SMS) because they are page-me incidents.

> **⚠️ BLOCKER (WAVE 5A / A3, 2026-06-24):** `OPS_ALERT_EMAIL` (`liberialearn52@gmail.com`),
> `OPS_ALERT_PHONE` (`+16672212732`), `SQS_DLQ_URL`, `SQS_QUEUE_URL`, `SENTRY_DSN`,
> `NEXT_PUBLIC_SENTRY_DSN`, and now `RESEND_API_KEY` are all set in Vercel Production.
> **Remaining blocker: no verified Resend sending domain.** A live drill against the real
> Resend API (valid key) was rejected: *"The liberialearn.edu.lr domain is not verified"* —
> and the `onboarding@resend.dev` test sender only delivers to the Resend account owner, which
> is not `liberialearn52@gmail.com`. The default `FROM` is `noreply@liberialearn.edu.lr`
> (`lib/email.ts`). So `sendEmail` reaches Resend but Resend drops the message →
> **ops-alert emails (and ALL transactional email) are still undeliverable.** SMS is also inert
> (`/api/health` → `sms:"unavailable"`). **To close:** (1) verify a sending domain at
> https://resend.com/domains (add the DNS records), (2) optionally set `EMAIL_FROM` to an
> address on that domain, (3) redeploy, (4) re-run the drill. Sentry capture is already
> verified working (see Alert 2 drill log).

---

## Alert 1 — Production deployment failed

**Trigger**: Vercel automatically fires this when a Production deployment fails.

**Config location**: Vercel Dashboard → Project → Settings → Notifications → Deployment failure
→ Add email (your Gmail) and optionally SMS webhook.

**What to do when it fires**:
1. Go to Vercel Dashboard → Deployments tab.
2. Open the failed deployment → Build Logs.
3. If it's a TypeScript or lint error: fix and push a new commit.
4. If it's an env-var error: check Vercel Dashboard → Settings → Environment Variables.
5. Users are still on the previous working deployment until a new one succeeds.

**Expected false-positive rate**: Very low. Every alert should be investigated.

**Drill log** (fill in after each drill):
| Date | Time to delivery | Recipient confirmed |
|------|-----------------|-------------------|
| | | |

---

## Alert 2 — Sentry error rate spike

**Trigger**: Sentry alert rule — "When errors in a 5-minute window > 50".
Also: any new issue with level=fatal fires immediately.

**Config location**: Sentry Dashboard → Alerts → Create Alert Rule → "Number of Errors"
- Condition: count > 50 in 5 minutes
- Actions: Email + PagerDuty (optional)

**What to do when it fires**:
1. Open Sentry → Issues → filter by "Last seen: last 1 hour".
2. Identify which route/function is throwing.
3. Check if it's a new deploy by comparing first-seen timestamp to last deploy time.
4. If caused by a bad deploy: roll back via Vercel → Promote earlier deployment.
5. If an ongoing issue: create a GitHub issue and start the incident timeline.

**Expected false-positive rate**: Low during no-traffic period. Once pilot starts,
tune the threshold based on actual baseline error rates.

**Drill log**:
| Date | Time to delivery | Recipient confirmed |
|------|-----------------|-------------------|
| 2026-06-24 | ~2 min (ingest+index) | ✅ PASS. WAVE 5A / A3: `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set in Vercel Prod (from project `liberialearn-web`), redeployed. Drill: logged in as `student1`, sent malformed JSON to `POST /api/discussion/posts` (unguarded `req.json()`). Prod returned HTTP 500; Sentry captured issue **LIBERIALEARN-WEB-T** — `SyntaxError: Unexpected token … is not valid JSON`, culprit `POST /api/discussion/posts`. Note: earlier-probed endpoints (`/api/student/teacher-lessons/[id]/complete`) swallow errors in try/catch and do NOT emit Sentry events. |

---

## Alert 3 — AI budget threshold breached

**Trigger**: Hourly cron `/api/cron/check-ai-budget`.
- Fires email if daily spend > 90% of `AI_BUDGET_DAILY_CAP_USD` (default $25).
- Fires email if MTD spend > 80% of `AI_BUDGET_MONTHLY_CAP_USD` (default $100).

**Config**: Set `OPS_ALERT_EMAIL` in Vercel env vars. Set `RESEND_API_KEY` to send emails.

**What to do when it fires**:
1. Open `/admin/ops/health` → Panel 3 (AI Spend) to identify which feature is spending.
2. If curriculum generation is the culprit: disable `ENABLE_CURRICULUM_CRON=false`.
3. If tutor usage is the culprit: check for an abusive session in Sentry.
4. If grading is the culprit: check for a batch grading run.
5. To increase the cap: `vercel env add AI_BUDGET_DAILY_CAP_USD`.

**Expected false-positive rate**: Zero during no-traffic period (no spend = no alert).
First 90% threshold hit after pilot start should be treated as real.

**Drill procedure**: Set `AI_BUDGET_DAILY_CAP_USD=0.001` temporarily, make one AI call,
confirm alert lands, then restore the real cap.

**Drill log**:
| Date | Time to delivery | Recipient confirmed |
|------|-----------------|-------------------|
| | | |

---

## Alert 4 — SQS DLQ has messages

**Trigger**: Every-15-minute cron `/api/cron/check-dlq`.
Fires email if DLQ depth > 0.

**Config**: Set `SQS_DLQ_URL` in Vercel env vars. Set `OPS_ALERT_EMAIL`.

**What to do when it fires**:
1. AWS Console → SQS → find the DLQ → View messages.
2. Inspect the message body to identify which job type failed.
3. Check Sentry for ECS worker errors in the same window.
4. Check AWS ECS → task logs for the relevant task.
5. If the job is safe to re-queue: move the message back to the main queue.
6. If the root cause is in code: fix it and redeploy. The next run will process new jobs.
7. See `docs/ops/RUNBOOK.md` (ECS worker section) for recovery steps.

**Expected false-positive rate**: Very low. DLQ messages indicate permanent worker failures.
Even one message deserves investigation.

**Drill procedure**: Send a deliberately malformed message to the main SQS queue.
The worker should reject it after retries and route it to the DLQ.
Then confirm the alert fires within 15 minutes.

**Drill log**:
| Date | Time to delivery | Recipient confirmed |
|------|-----------------|-------------------|
| | | |

---

## Alert 5 — ECS worker unhealthy (SHOULD ALSO BE SMS)

**Trigger**: Existing cron `/api/admin/ops/cron/autonomous/runtime-health` runs every 5 min
and records worker status in the Autonomous OS runtime tables. The Vercel cron itself
will appear as failed in the Vercel dashboard if the endpoint errors.

For a more direct signal: configure a Sentry alert rule on `[WORKER]` error tags.

**What to do when it fires**:
1. AWS Console → ECS → liberia-learn cluster → service → Tasks tab.
2. If runningCount = 0: click "Update Service" → "Force new deployment".
3. If the task fails to start: inspect "Stopped Tasks" → "Task details" for the error.
4. Check ECR to ensure the image exists and was pushed correctly.
5. Check task definition memory/CPU limits — OOM kills show as exit code 137.
6. See `docs/ops/WORKER_DEPLOYMENT.md` for rollback procedure.

**Expected false-positive rate**: Low. Brief restarts (< 5 min) are normal during deploys.

**Drill procedure**: Manually set ECS service desiredCount = 0, wait 6 minutes,
then check if the runtime-health cron logs an error. Restore to 1.

**Drill log**:
| Date | Time to delivery | Recipient confirmed |
|------|-----------------|-------------------|
| | | |

---

## Alert 6 — Supabase connection pool saturation

**Trigger**: A Sentry alert rule that fires when PrismaClientKnownRequestError P1001
("Can't reach database server") appears more than 5 times in 5 minutes.

**Config in Sentry**: Alerts → New Alert → Error Frequency
- Filter: `PrismaClientKnownRequestError` AND message contains `P1001`
- Condition: count > 5 in 5 minutes

**What to do when it fires**:
1. Supabase Dashboard → Database → Connection Pooling → check active connections.
2. If near the limit: short-term fix is to restart the pooler (via Supabase dashboard).
3. Confirm DATABASE_URL uses the pooled URL (port 6543, not 5432 which is direct).
4. If sustained: reduce max connections in DATABASE_URL param, or upgrade Supabase tier.
5. See `docs/ops/DB_POOL.md` for detailed guidance.

**Expected false-positive rate**: Low. P1001 errors are almost always real pool saturation
or a transient network blip. 5-in-5-minutes threshold avoids alerting on single blips.

**Drill log**:
| Date | Time to delivery | Recipient confirmed |
|------|-----------------|-------------------|
| Untested — alert expected but not drilled before pilot | | |

---

## Setup checklist

Before pilot onboards, confirm:
- [ ] `OPS_ALERT_EMAIL` set in Vercel env vars (production)
- [ ] `OPS_ALERT_PHONE` set if SMS alerting desired
- [ ] `RESEND_API_KEY` set (for email sending via lib/email.ts)
- [ ] Vercel deployment-failure notification configured in dashboard
- [ ] Sentry error rate spike alert rule created
- [ ] Sentry P1001 alert rule created
- [ ] `SQS_DLQ_URL` set if using SQS (for DLQ depth check)
- [ ] Drilled each alert at least once (see drill logs above)
