# LiberiaLearn — Deployment Guide

**Version:** 1.0.0
**Last updated:** 2026-03-01
**Platform:** Next.js 14 · Prisma · Supabase · Vercel

---

## 1. Prerequisites

### Runtime
| Requirement | Version |
|-------------|---------|
| Node.js | 18.x or 20.x LTS |
| npm | 9.x+ |
| PostgreSQL | 14+ (Supabase managed) |

### External services
| Service | Purpose | Required |
|---------|---------|---------|
| Supabase | PostgreSQL database + auth | Yes |
| OpenAI | AI curriculum + grading endpoints | Yes (for AI features) |
| Resend | Transactional email | Yes (for invites + recovery) |
| Africa's Talking | SMS (primary) | Yes (for SMS features) |
| Twilio | SMS (fallback) | No |
| Vercel | Hosting + edge runtime | Recommended |
| Sentry | Error monitoring | No (but recommended) |

### Repository access
```
git clone https://github.com/liberialearn/platform.git
cd platform
```

---

## 2. First Deployment

### 2.1 Install dependencies
```bash
npm install
```

### 2.2 Configure environment variables

Copy the example file and fill in real values:
```bash
cp .env.example .env.local
```

Minimum required variables:
```bash
# Database (Supabase)
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[pass]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# Auth
NEXTAUTH_URL="https://your-deployment-url.vercel.app"
NEXTAUTH_SECRET="<32-byte random — generate with: openssl rand -base64 32>"

# AI
OPENAI_API_KEY="sk-..."

# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="LiberiaLearn <noreply@liberialearn.edu.lr>"

# SMS
AT_API_KEY="..."
AT_USERNAME="liberialearn"
AT_ENVIRONMENT="production"
AT_SENDER_ID="LRLEARN"
```

Full variable reference: see `docs/rollout/ENV_VARS.md`

### 2.3 Generate Prisma client
```bash
npx prisma generate
```

### 2.4 Apply database migrations
```bash
npx prisma migrate deploy
```

This applies all pending migrations to the Supabase database.
Two migrations may be pending on a fresh database:
- `20260228_block26_perf_indexes` — composite performance indexes
- `20260301_000001_moe_official_role` — MOE_OFFICIAL role enum value

Both are additive and safe to apply.

### 2.5 Seed initial data
```bash
npx prisma db seed
```

Seeds: MOE standard codes (53), strand catalog (92 strands), virtual labs.

### 2.6 Build
```bash
npm run build
```

The build command runs `prisma generate` + `next build`.
Expect ~60–90 seconds on a clean build.

### 2.7 Start (self-hosted) or Deploy (Vercel)

**Self-hosted:**
```bash
npm start
```

**Vercel:**
1. Connect the repository in Vercel dashboard
2. Set environment variables in Vercel → Project Settings → Environment Variables
3. Deploy via Vercel CLI or Git push: `git push origin main`

---

## 3. Health Verification

### 3.1 Health endpoint
```bash
curl https://your-deployment-url.vercel.app/api/health
```

Expected healthy response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-03-01T10:00:00.000Z",
  "checks": {
    "database": "ok",
    "migrations": "ok",
    "aiFactory": "ok",
    "sms": "ok"
  }
}
```

- `200 healthy` — all systems operational
- `200 degraded` — partial functionality (e.g. AI key missing, pending migrations)
- `503 unhealthy` — database unreachable; investigate immediately

### 3.2 Health check script
```bash
npx ts-node scripts/dr/healthCheck.ts
# For JSON output (CI-friendly):
npx ts-node scripts/dr/healthCheck.ts --json
```

### 3.3 Verify seed data
```bash
# Check MOE standards loaded (expect 53 rows)
npx prisma studio
# Navigate to MoeStandard model
```

Or via the MOE portal after enabling `ENABLE_MOE_PORTAL=true`:
```bash
curl -H "Authorization: Bearer <token>" \
  https://your-deployment-url.vercel.app/api/moe/standards-coverage
```

---

## 4. Feature Flag Activation Sequence

All feature flags default to **OFF**. Enable them in phases to reduce risk.

### Phase 1 — Core (enable immediately)
```bash
ENABLE_GOV_EXPORTS=true          # Governance export routes
ENABLE_MOE_PORTAL=true           # MOE national oversight portal
NEXT_PUBLIC_ENABLE_MASTERY_ENGINE=true
```

### Phase 2 — AI Factory + Teacher Tools (after Phase 1 stable, ~1 week)
```bash
AI_BUDGET_MONTHLY_CAP_USD=150    # Set budget cap before enabling AI
ENABLE_AI_GRADING_ASSIST=true
ENABLE_CURRICULUM_FEEDBACK=true
ENABLE_DELIVERY_PROFILE=true
ENABLE_CLASSROOM_TOOLKIT=true
ENABLE_TOOLKIT_CALCULATOR=true
ENABLE_TOOLKIT_SCIENCE_TOOLS=true
ENABLE_TOOLKIT_GEO_TOOLS=true
ENABLE_TOOLKIT_TIMER=true
```

### Phase 3 — Delivery Engine (after Phase 2 stable)
```bash
ENABLE_LESSON_DELIVERY_TRACKING=true
ENABLE_UNIT_GROUPING=true
ENABLE_ASSIGNMENT_LESSON_LINKAGE=true
ENABLE_VIRTUAL_LABS=true
ENABLE_DELIVERY_COMPLIANCE_REPORTING=true
ENABLE_TOOLKIT_LESSON_INTEGRATION=true
```

### Phase 4 — Analytics + Predictive (requires 6+ weeks of baseline data)
```bash
ENABLE_IMPACT_ANALYTICS=true
ENABLE_DISTRICT_INTELLIGENCE=true
ENABLE_GEO_INTELLIGENCE=true
ENABLE_NATIONAL_INSIGHTS=true
ENABLE_INTERVENTION_ALERTS=true
ENABLE_AI_INTERVENTIONS=true
ENABLE_DROPOUT_RISK=true          # After 6 months of data
ENABLE_CURRICULUM_OPTIMIZATION=true
```

### Phase 5 — User Self-Service Flows
```bash
ENABLE_ENROLLMENT_INVITES=true
NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES=true
ENABLE_ACCOUNT_RECOVERY=true
NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY=true
ENABLE_GUARDIAN_PORTAL=true
NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL=true
ENABLE_GUARDIAN_LINKING=true
```

> **Note:** NEXT_PUBLIC_* flags are inlined at build time. Changing them requires a rebuild.
> Server-only ENABLE_* flags take effect at request time — no rebuild needed.

---

## 5. Updating an Existing Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install any new dependencies
npm install

# 3. Apply database migrations (always before restart)
npx prisma migrate deploy

# 4. Rebuild (Vercel does this automatically on push)
npm run build

# 5. Restart (self-hosted only)
npm start

# 6. Verify health
curl https://your-deployment-url.vercel.app/api/health
```

### Zero-downtime deploys on Vercel
Vercel performs zero-downtime deployments automatically. New traffic routes to the new
deployment only after a successful build. No manual restart is required.

---

## 6. Rollback

### Emergency feature flag rollback (no deploy required)
```bash
# Disable any feature flag instantly via Vercel dashboard or env var update:
ENABLE_MOE_PORTAL=false
ENABLE_AI_GRADING_ASSIST=false
# etc.
```

### Emergency governance shutdown (single kill switch)
```bash
ENABLE_GOV_CIRCUIT_BREAKER=true
# Disables ALL governance exports and audit search immediately.
```

### Code rollback
See `docs/rollout/ROLLBACK_RUNBOOK.md` for full block-by-block rollback procedures.

Quick reference:
```bash
# List available rollback plans
npx ts-node scripts/dr/rollbackPlan.ts --list

# View rollback steps for a specific block
npx ts-node scripts/dr/rollbackPlan.ts --block 28
```

---

## 7. Monitoring

### What to watch

| Metric | Alert threshold | Action |
|--------|----------------|--------|
| `GET /api/health` status | Non-200 for 2+ consecutive checks | Investigate immediately |
| Database error rate | >1% of queries | Check Supabase status + connection pool |
| AI spend (`AiInteractionLog`) | >80% of `AI_BUDGET_MONTHLY_CAP_USD` | Review usage; increase cap or throttle |
| Response time p95 | >2s on teacher/schedule, >3s on MOE routes | Check DB indexes + query plans |
| 5xx error rate | >0.5% per minute | Check application logs |

### Health endpoint polling
- Load balancer: poll `GET /api/health` every **30 seconds**
- Uptime monitor: poll every **60 seconds** from external location
- CI/CD pipeline: poll once after deploy, fail deployment if not `200 healthy` within 120 seconds

### Log aggregation
The platform emits structured JSON logs when `LOG_STRUCTURED` is set.
Each log line is a JSON object suitable for ingestion by Datadog, Supabase Log Drains,
or any NDJSON-compatible aggregator.

**To enable structured logging:**
```bash
LOG_LEVEL=info   # enables logging (omit to use default)
# LOG_LEVEL=silent to suppress all request logs (e.g. during load tests)
```

**Log fields:**
```json
{
  "method": "GET",
  "route": "/api/teacher/schedule",
  "statusCode": 200,
  "durationMs": 143,
  "userIdHash": "a3f92d...",
  "schoolId": "school-abc",
  "role": "TEACHER",
  "timestamp": "2026-03-01T10:00:00.000Z"
}
```

No PII is ever logged: raw user IDs are SHA-256 hashed; request bodies are not logged.

### Sentry integration
Set `NEXT_PUBLIC_SENTRY_DSN` to enable automatic error capture on both client and server. Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` together if you want source-map uploads during build.

### Audit log review
Platform admins can search and export audit logs via the governance UI
(`GET /api/gov/audit-search`). Enabled when `ENABLE_GOV_AUDIT_SEARCH=true` (default ON).
