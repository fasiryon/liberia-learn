# LiberiaLearn On-Call Runbook

**Audience**: The operator — the one person who will get woken up when something breaks.
**Purpose**: You read this at 2am when something is broken. Use the dashboard to identify
*which* thing is broken, then jump to the relevant section here.

---

## When to read this

Something is broken in production. Open `/admin/ops/health` first.
If that loads, the app is alive — use the panel colours to identify the failure domain
and jump to that section below.

---

## Quick triage (60 seconds)

1. **Is the site loading?** Open `https://liberia-learn.vercel.app` (or production domain).
2. **Is `/admin/ops/health` loading?** If not, the app itself is down → see "Site Down".
3. **Which panel is red?** Jump to that section:
   - Panel 1 red → DB or Redis is down
   - Panel 2 red → error rate spike → check Sentry
   - Panel 3 red → AI spend near cap → throttle
   - Panel 6 red → DLQ has messages → worker failures
4. **Nothing red but users complaining?** Check Sentry directly (link in Panel 2).

---

## Common failures

### Vercel deployment broken

**Symptom**: Deploy alert fired; site shows old version or 500s on some routes.

**Diagnosis**: Vercel Dashboard → Deployments → most recent → Status column.

**Fix**:
1. If the new deploy is still "Building": wait for it or check logs.
2. If it failed: Vercel Dashboard → failed deployment → "Promote to Production" on the last
   known-good deployment listed above it.
3. Fix the underlying issue (TypeScript error, missing env var) and push again.

**Prevention**: Every commit passes `npx tsc --noEmit && npx vitest run && npm run build`
before pushing. The gate results are in the commit message.

---

### Database connection errors (P1001)

**Symptom**: Sentry shows `PrismaClientKnownRequestError` with `P1001`; `/admin/ops/health`
shows DB panel in red.

**Diagnosis**: Supabase Dashboard → Database → Connection Pooling tab → active connections.

**Fix**:
(a) Wait 60 seconds — single-instance transient blips usually resolve on their own.  
(b) If sustained: Supabase Dashboard → Connection Pooling → "Restart Pooler" button.  
(c) Confirm `DATABASE_URL` points to the **pooled** URL (port **6543**, not 5432).
    Port 5432 is the direct connection and will saturate quickly under any load.

**Pitfall**: If you used `vercel env pull` recently, check that `DATABASE_URL` didn't get
overwritten with a direct URL. The pooled URL contains `pooler.supabase.com:6543`.

---

### AI spend overrun

**Symptom**: AI budget alert at 90% daily or 80% monthly.

**Diagnosis**: `/admin/ops/health` Panel 3 → which feature has the highest spend today.

**Fix by feature**:
- **curriculum**: The generation cron is running. Check whether a regen job is still
  in progress (`/admin/ops/health` Panel 6). To stop it: disable the cron temporarily
  by setting `ENABLE_CURRICULUM_CRON=false` in Vercel env.
- **tutor**: Check for an abusive or looping student session. Sentry → search for repeated
  AI tutor calls from the same userId in a short window. If found, contact the school.
- **grading**: A batch grading run may have triggered. Check
  `/admin/ops/curriculum-review` for a spike in graded items.
- **labs**: Similar to curriculum. Check if a manual labs generation script is running.

**Increase the cap** (if it's legitimate traffic):
```
vercel env add AI_BUDGET_DAILY_CAP_USD production
```

---

### ECS worker down

**Symptom**: Alert 5 fired; `/admin/ops/runtime/workers` shows runningCount = 0;
queue depth growing but not processing.

**Diagnosis**: AWS Console → ECS → liberia-learn cluster → Service → Tasks tab.

**Fix**:
1. Click "Update Service" → "Force new deployment". AWS will try to start a new task.
2. Watch the Events tab for the new task state. It should reach "RUNNING" within 2 minutes.
3. If it stops immediately: check "Stopped Tasks" → click the task → scroll to "Stopped reason".
4. Common stop reasons:
   - **Exit code 1** (app error): check CloudWatch Logs → task log group → latest stream.
   - **Exit code 137** (OOM): increase task definition memory (1024 → 2048 MB).
   - **CannotPullContainerError**: ECR image doesn't exist. Check last pushed tag.
5. See `docs/ops/WORKER_DEPLOYMENT.md` for image rollback procedure.

---

### Student reports stuck submission

**Symptom**: Student or teacher says "I submitted but it didn't save."

**Diagnosis**: This is the NR-14A offline queue. When a student submits while offline
(or on a flaky connection), the submission is queued locally in their browser's IndexedDB.
It will sync automatically when they reconnect.

**Fix**:
1. Ask the student: "Were you connected to the internet when you hit Submit?"
   - If no → tell them to reconnect and the app will retry automatically.
   - If yes → look up their `HomeworkSubmission` record by userId in the DB.
2. If there's genuinely no record after they reconnected, have them re-submit.
   The `clientSubmissionId` field prevents duplicate submissions even on retry.

**Not a bug** unless: the student was online, the app showed a success confirmation,
and still no record exists. In that case, check Sentry for the route error.

---

### Judge0 unavailable (code grading broken)

**Symptom**: Student code submissions return 503; `/api/grading/code` logs show Judge0 errors.

**Diagnosis**: Check RapidAPI Dashboard → Judge0 CE → Usage tab.

**Fix**:
(a) **Quota exhausted** → upgrade Judge0 tier in RapidAPI, or wait for daily reset.
    Current quota is the free tier. Check reset time in RapidAPI dashboard.  
(b) **Judge0 API outage** → check RapidAPI status page and Judge0 status. No fix from
    our side. Show students a "Code grading temporarily unavailable" message (currently
    handled gracefully in the UI — it shows a soft error, not a crash).

**Note**: The Judge0 API key is `JUDGE0_API_KEY` in Vercel env vars. If you recently
rotated it, confirm the new key is also updated in Vercel production env.

---

### MOE official complaint about lesson content

**Symptom**: MOE contact reports a specific lesson is wrong, missing, or inappropriate.

**Diagnosis**:
- `/admin/curriculum/coverage` → find the grade/subject cell
- `/admin/ops/curriculum-review` → locate the specific lesson

**Fix**:
(a) **Wrong content** → re-queue via the regen pipeline:
    ```
    npx dotenv -e .env.production -- npx tsx scripts/requeue-needs-review.ts \
      --grades G<N> --subjects SUBJECT --limit 10
    ```
    Then process: `npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts --limit 10`
(b) **Missing content** → use the desert-cell generation script.
(c) **Inappropriate content** → use the admin curriculum reject endpoint to pull it from
    student view immediately (`/api/admin/curriculum/[id]/reject`), then re-queue.

**Always communicate an ETA back to the MOE contact.** Regen takes ~2 minutes per lesson.
A batch of 10 lessons is fully replaced in under 30 minutes.

---

## Rollback procedures

### App rollback
1. Vercel Dashboard → Deployments
2. Find last known-good deployment (green checkmark before the bad one)
3. Click the three-dot menu → "Promote to Production"
4. Takes ~30 seconds to propagate

### Feature flag rollback
For any feature gated in `lib/serverFlags.ts`:
```
vercel env add FEATURE_FLAG_NAME false production
```
Then redeploy (or wait for the next request — most flags are read at request time).

### Database rollback
**Never roll back the database unless you have a recent backup and the rollback is explicitly
safer than the forward fix.** Nightly CSV backups are stored in Vercel Blob
(`backups/YYYY-MM-DD/`). To restore:
1. Download from Vercel Dashboard → Storage → Blob
2. Import via Supabase Dashboard → Table Editor or SQL Editor
3. Notify affected users of any data loss

### Env var rollback
```
vercel env rm VAR_NAME production
vercel env add VAR_NAME <old_value> production
```

---

## Escalation paths

| Layer | Who to contact |
|-------|---------------|
| App (Vercel, Next.js) | No external escalation — fix in code, you own this |
| Database (Supabase) | support@supabase.io — pro plan SLA |
| AI providers | OpenAI / Groq / Cohere status pages; outages are usually short |
| ECS / AWS | AWS Support (if on a paid plan); otherwise, community forums |
| DNS / domains | Where the domain is registered + Vercel DNS settings |
| SMS (Africa's Talking) | Africa's Talking developer dashboard / support |

---

## Knowing when you're in over your head

If you've spent more than 2 hours on an incident and the problem is getting worse, not better:

1. **Communicate** the outage to MOE contacts honestly with what you know.
2. **Roll back** to the last known-good Vercel deployment.
3. **Document** everything you tried: timestamps, what you observed, what you changed.
4. **Rest** and investigate fresh. Most production incidents are solved with a clear head,
   not by pushing through exhaustion at 4am.

The platform is pre-pilot. A brief outage right now has zero student impact.
The goal is to *have* an outage, handle it well, and learn from it before real students
depend on it.

---

## Quick command reference

```bash
# Check content pipeline status
npx dotenv -e .env.production -- npx tsx scripts/content-status-audit.ts

# Check audio coverage
npx dotenv -e .env.production -- npx tsx scripts/audio-coverage-audit.ts

# Re-queue NEEDS_REVIEW lessons
npx dotenv -e .env.production -- npx tsx scripts/requeue-needs-review.ts --grades G5,G6 --subjects MATH --dry-run

# Process regen jobs
npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts --limit 10

# Generate scaffolds
npx dotenv -e .env.production -- npx tsx scripts/generate-scaffolds.ts --limit 25

# Health check (scripts version)
DATABASE_URL=$DIRECT_URL npx tsx scripts/dr/healthCheck.ts
```

---

*Last updated: NR-15 sprint (2026-06-02). Update this document whenever you encounter a new
failure mode or discover a faster fix for an existing one.*
