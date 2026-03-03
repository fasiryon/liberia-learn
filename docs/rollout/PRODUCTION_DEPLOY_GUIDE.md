# LiberiaLearn — Vercel + Supabase Production Deploy Guide

**Version:** 1.0.0
**Date:** 2026-03-02
**Audience:** Platform operators, Ministry of Education ICT Directorate
**Prerequisite reading:** `docs/rollout/ENV_VARS.md`, `docs/rollout/ROLLBACK_RUNBOOK.md`

---

## Overview

This guide covers the end-to-end procedure to deploy LiberiaLearn to production using
**Vercel** (hosting) and **Supabase** (PostgreSQL database). It supersedes the general
`DEPLOYMENT_GUIDE.md` with Vercel-specific steps.

Estimated time for a fresh first deployment: **45–90 minutes** (most of this is
waiting for Vercel build + DNS propagation).

---

## 1. Supabase Project Setup

### 1.1 Create a new Supabase project

1. Sign in at [supabase.com](https://supabase.com) → **New project**
2. Select **AWS region: us-east-1** (closest to Liberia's internet routing)
3. Set a strong database password — store it in a password manager
4. Wait for project to provision (~2 minutes)

### 1.2 Get connection strings

From **Project Settings → Database → Connection string**:

| Variable | Where to find it |
|----------|-----------------|
| `DATABASE_URL` | Settings → Database → Connection pooling → **Transaction mode** (port 6543) |
| `DIRECT_URL` | Settings → Database → Connection string → **URI** (port 5432) |

**Required format:**
```
DATABASE_URL="postgresql://postgres.<ref>:<pass>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<pass>@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

> **Note:** `DATABASE_URL` uses the pooled connection (PgBouncer) for runtime queries.
> `DIRECT_URL` uses a direct connection for Prisma migrations only.

### 1.3 Supabase checklist

- [ ] Project created in AWS us-east-1 region
- [ ] Database password stored securely (password manager or Vercel env vault)
- [ ] `DATABASE_URL` (pooled) obtained
- [ ] `DIRECT_URL` (direct) obtained
- [ ] Row-Level Security: LiberiaLearn manages tenant isolation at the application layer.
      **Do not enable RLS on Prisma-managed tables** — it will conflict with Prisma's
      connection pool behavior.

---

## 2. Vercel Project Setup

### 2.1 Import the repository

1. Sign in at [vercel.com](https://vercel.com)
2. **Add New → Project → Import Git Repository**
3. Select the LiberiaLearn repository
4. Framework: **Next.js** (auto-detected via `vercel.json`)
5. Root directory: `/` (default)
6. Build command: `npm run build` (auto-detected)
7. Install command: `npm install` (auto-detected)

### 2.2 Configure environment variables

Navigate to **Project → Settings → Environment Variables**.

Set the following for **Production** environment (and optionally Preview):

#### Required (deployment will fail without these)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase pooled URL |
| `DIRECT_URL` | Supabase direct URL |
| `NEXTAUTH_URL` | `https://liberialearn.edu.lr` (or your Vercel domain) |
| `NEXTAUTH_SECRET` | Run: `openssl rand -base64 32` — store the output |

#### Required for AI features

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key (sk-...) |
| `AI_BUDGET_MONTHLY_CAP_USD` | `150` (recommended initial cap) |

#### Required for Email

| Variable | Value |
|----------|-------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | `noreply@liberialearn.edu.lr` |

#### Required for SMS

| Variable | Value |
|----------|-------|
| `AT_API_KEY` | Africa's Talking API key |
| `AT_USERNAME` | Africa's Talking username |
| `AT_ENVIRONMENT` | `production` |
| `AT_SENDER_ID` | `LRLEARN` (or approved sender ID) |

#### Phase 1 feature flags (enable at launch)

| Variable | Value |
|----------|-------|
| `ENABLE_GOV_EXPORTS` | `true` |
| `ENABLE_MOE_PORTAL` | `true` |
| `ENABLE_MOE_LOGIN_PORTAL` | `true` |
| `NEXT_PUBLIC_ENABLE_MASTERY_ENGINE` | `true` |

> **NEXT_PUBLIC_* variables are inlined at build time.** Changing them requires a
> new Vercel deployment. Server-only `ENABLE_*` flags take effect at request time
> with no rebuild needed.

For the complete variable list, see `docs/rollout/ENV_VARS.md`.

### 2.3 Deploy

After setting all environment variables:
1. Go to **Deployments → Create Deployment** (or push to main branch)
2. Vercel will run `npm run build` (which runs `prisma generate && next build`)
3. Monitor build logs — expect 60–120 seconds

If build fails:
- Check that all required env vars are set (DATABASE_URL, NEXTAUTH_SECRET,
  NEXTAUTH_URL are required at build time for Prisma generate)
- If `prisma generate` fails: verify DATABASE_URL format matches Supabase pooler URL

---

## 3. Database Migration

After the first successful build, run migrations **before any user traffic**:

### 3.1 Apply migrations via Prisma CLI

From your local machine (with `DIRECT_URL` pointing to Supabase):

```bash
# One-time setup: set env vars locally
export DATABASE_URL="postgresql://postgres.<ref>:<pass>@...pooler.../postgres?pgbouncer=true"
export DIRECT_URL="postgresql://postgres.<ref>:<pass>@...direct.../postgres"

# Apply all migrations
npx prisma migrate deploy
```

Expected output:
```
Applying migration `20260213_222830_baseline_from_existing_db`
...
Applying migration `20260302_engineering_cs_standards`
24 migrations applied.
```

> **If you see "already applied"**: That's fine — `migrate deploy` is idempotent.
> **If you see errors**: Check that `DIRECT_URL` (not pooled) is being used.

### 3.2 Seed initial data

```bash
npx prisma db seed
```

Seeds:
- MOE standard codes (63 codes across MATH, SCI, LIT, CIV, CS, ENGINEERING)
- Strand catalog (92+ strands)
- Virtual labs (6 seeded labs)

### 3.3 Migration checklist

- [ ] 24 migrations applied without errors
- [ ] `_prisma_migrations` table shows all rows with `finished_at` set
- [ ] Seed data loaded (verify via Prisma Studio or health endpoint)
- [ ] `GET /api/health` returns `{ "status": "healthy" }` (not "degraded")

---

## 4. DNS Configuration

### 4.1 Custom domain on Vercel

1. **Project → Settings → Domains → Add domain**
2. Enter `liberialearn.edu.lr`
3. Vercel provides a CNAME record: `cname.vercel-dns.com`

### 4.2 DNS records to create

| Type | Name | Value |
|------|------|-------|
| CNAME | `liberialearn` | `cname.vercel-dns.com` |
| CNAME | `www` | `cname.vercel-dns.com` |

> DNS propagation: 15 minutes – 48 hours depending on registrar TTL.
> Vercel auto-provisions Let's Encrypt TLS for the domain.

### 4.3 Update NEXTAUTH_URL

Once the custom domain is verified in Vercel:
1. Update `NEXTAUTH_URL` in Vercel env vars to `https://liberialearn.edu.lr`
2. Trigger a new deployment to pick up the change

---

## 5. Post-Deploy Smoke Test

Perform these 15 checks after every production deployment:

| # | Check | Expected | Method |
|---|-------|----------|--------|
| 1 | Health endpoint | `{ "status": "healthy" }` | `GET /api/health` |
| 2 | Home page loads | 200, no JS errors | Open `https://liberialearn.edu.lr` |
| 3 | Login page loads | 200, form visible | Open `/login` |
| 4 | MOE login portal | Login form at `/moe/login` | Open `/moe/login` (requires `ENABLE_MOE_LOGIN_PORTAL=true`) |
| 5 | Unauthenticated API rejects | 401 JSON response | `GET /api/teacher/schedule` without auth |
| 6 | MOE API rejects non-MOE role | 403 | Login as TEACHER, `GET /api/moe/dashboard` |
| 7 | MOE dashboard accessible | 200 with counts | Login as MOE_OFFICIAL, `GET /api/moe/dashboard` |
| 8 | Standards coverage | 200, `overallCoverageRate` present | `GET /api/moe/standards-coverage` |
| 9 | Governance exports | 200, schools present | Login as ADMIN, `GET /api/admin/governance/exports/student-performance` |
| 10 | Audit log search | 200, `entries` array | Login as ADMIN, `GET /api/admin/compliance/audit-log` |
| 11 | CSV streaming | Starts download | Login as ADMIN, `GET /api/admin/compliance/audit-log?format=csv` |
| 12 | Teacher schedule | 200 or empty list | Login as TEACHER, `GET /api/teacher/schedule` |
| 13 | Student work | 200 or empty | Login as STUDENT, `GET /api/student/work` |
| 14 | Seed data loaded | ≥53 standard codes | Via Prisma Studio or MOE standards-coverage route |
| 15 | Offline service worker | `sw.js` accessible | `GET /sw.js` returns 200 (JS content) |

### Health script (CI-friendly)
```bash
npx ts-node scripts/dr/healthCheck.ts --json
# Expect: { "overallStatus": "healthy" }
# Exit 0 = healthy/degraded, Exit 1 = unhealthy (action required)
```

---

## 6. Feature Flag Activation Sequence

Enable flags in phases to reduce risk. See `docs/rollout/DEPLOYMENT_GUIDE.md §4`
for the full phased rollout plan. Minimum for day-one operation:

```bash
# Phase 1: Core governance + MOE portal
ENABLE_GOV_EXPORTS=true
ENABLE_MOE_PORTAL=true
ENABLE_MOE_LOGIN_PORTAL=true
NEXT_PUBLIC_ENABLE_MASTERY_ENGINE=true
```

All other flags default to `false`. Enable them as per the phased plan after
confirming Phase 1 stability.

---

## 7. Vercel Cold Start Behavior

Vercel Serverless Functions (Next.js App Router API routes):

- **Cold start**: ~200–800 ms for the first request to a new Lambda instance
- **Warm instance**: Subsequent requests within the same instance are fast (~10–50 ms overhead)
- **In-memory state**: The `lib/rateLimit.ts` in-memory map and `lib/offline/offlineQueue.ts`
  are **per-instance** — they reset on every cold start. This means:
  - Rate limiting provides partial protection (within a warm instance) but not full
    cross-request persistence. For production at national scale, replace the in-memory
    rate limiter with a Redis/Upstash-backed limiter before enabling public registration.
  - The offline queue is only used for server-side idempotency tracking, not persistent
    state — this is acceptable.
- **Prisma connection pooling**: `DATABASE_URL` uses PgBouncer (port 6543) which manages
  connection pooling at the Supabase level. This is required for serverless — do NOT use
  the direct URL (port 5432) for `DATABASE_URL`.

**Recommended Vercel function config** (set in Vercel dashboard or via `vercel.json`):
- Region: `iad1` (us-east-1, closest to Liberia)
- Timeout: default (10s) is sufficient; MOE routes may benefit from 30s for large datasets

---

## 8. Rollback on Vercel

### Instant rollback (Vercel UI)
1. **Deployments → Select previous deployment → Promote to Production**
2. No rebuild required — Vercel serves the previous build immediately
3. Takes ~30 seconds

### Feature flag rollback (no deploy)
```bash
# Disable a feature instantly via Vercel env vars dashboard:
ENABLE_MOE_PORTAL=false          # disable MOE portal
ENABLE_GOV_CIRCUIT_BREAKER=true  # kill all governance exports
```
Vercel picks up env var changes on the next request (no redeploy for server-side flags).

### Code rollback
See `docs/rollout/ROLLBACK_RUNBOOK.md` for block-by-block rollback procedures.

```bash
# List rollback plans
npx ts-node scripts/dr/rollbackPlan.ts --list

# Get steps for a specific block
npx ts-node scripts/dr/rollbackPlan.ts --block 28
```

---

## 9. Monitoring Setup

### Sentry (recommended)
1. Create a project at sentry.io
2. Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel env vars
3. Error events will appear in Sentry for both client and server routes

### Health monitoring
Set up an external uptime monitor (UptimeRobot, Freshping, etc.):
- **URL**: `https://liberialearn.edu.lr/api/health`
- **Interval**: 60 seconds
- **Alert on**: Non-200 for 2+ consecutive checks

### Log draining
Enable Vercel Log Drain → send to your log aggregator (Datadog, Papertrail, etc.):
- Platform emits structured JSON when `LOG_LEVEL=info` is set

---

## 10. Database Backup

Supabase provides automated daily backups:
- **Free tier**: 7-day backups
- **Pro tier**: 30-day backups + PITR (Point-in-Time Recovery)

**Recommended for national deployment:** Upgrade to Supabase Pro for PITR.

Manual backup before major deploys:
```bash
pg_dump $DIRECT_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## Quick Reference Checklist

```
Pre-deploy (do in order):
[ ] Supabase project provisioned
[ ] DATABASE_URL and DIRECT_URL obtained
[ ] All required env vars set in Vercel
[ ] Vercel deployment: PASS (exit 0)
[ ] npx prisma migrate deploy — 24 migrations applied
[ ] npx prisma db seed — MOE standards + strand catalog loaded
[ ] GET /api/health → { "status": "healthy" }
[ ] 15-step smoke test passed
[ ] MOE_OFFICIAL accounts created and assigned
[ ] MOE_PORTAL_ALLOWLIST set to @moe.gov.lr
[ ] Phase 1 flags enabled (see §6)

Post-deploy (within 24 hours):
[ ] Sentry errors reviewed (should be zero)
[ ] /api/health polled for 30 minutes — stable healthy
[ ] MOE officials can log in and view dashboard
[ ] Governance export tested end-to-end
```
