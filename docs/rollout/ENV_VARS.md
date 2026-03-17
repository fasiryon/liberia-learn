# LiberiaLearn — Environment Variable Reference

**Version:** 1.0.0
**Last updated:** 2026-03-01

All variables are read at **call time** (not module load) to support test isolation.
Server-only vars must never be referenced from client components.

---

## 1. Core Infrastructure (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Supabase pooled connection string (PgBouncer) | `postgresql://postgres.[ref]:[pass]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase direct connection (for Prisma migrations) | `postgresql://postgres.[ref]:[pass]@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |
| `NEXTAUTH_URL` | Canonical URL of the deployment | `https://liberialearn.edu.lr` |
| `NEXTAUTH_SECRET` | Random 32-byte secret for JWT signing | `openssl rand -base64 32` |

---

## 2. AI Providers (Required for AI features)

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (primary AI provider) | — (required for AI routes) |
| `GROQ_API_KEY` | Groq API key (fast-tier router fallback) | — (optional) |
| `AI_BUDGET_MONTHLY_CAP_USD` | Monthly AI spend cap in USD. All AI endpoints return 503 when exceeded | `100` |

---

## 3. Communications

### Email (Resend)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | Sender address (e.g. `noreply@liberialearn.edu.lr`) |

### SMS — Africa's Talking (primary)

| Variable | Description |
|----------|-------------|
| `AT_API_KEY` | Africa's Talking API key |
| `AT_USERNAME` | Africa's Talking username |
| `AT_ENVIRONMENT` | `sandbox` or `production` |
| `AT_SENDER_ID` | Approved sender ID for Liberian carriers |

### SMS — Twilio (fallback)

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio sending number |

---

## 4. Monitoring

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Server-side Sentry DSN for Next.js and the ECS worker |
| `SENTRY_ORG` | Sentry org slug used for source map uploads |
| `SENTRY_PROJECT` | Sentry project slug for web build uploads |
| `SENTRY_AUTH_TOKEN` | Sentry auth token used in CI for source map uploads |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for client + server error capture |

### AWS Export Storage

| Variable | Description |
|----------|-------------|
| `AWS_REGION` | AWS region for S3 and ECS resources |
| `AWS_S3_EXPORTS_BUCKET` | Private S3 bucket used for governance export objects |
| `AWS_ACCESS_KEY_ID` | Optional AWS access key for local/export automation |
| `AWS_SECRET_ACCESS_KEY` | Optional AWS secret key for local/export automation |

---

## 5. Server-Side Feature Flags

All server flags are read from `lib/serverFlags.ts`. Default is **OFF** unless noted.

### Ops Intelligence (Block 5)

| Variable | Description | Default |
|----------|-------------|---------|
| `OPS_AI_EXPLANATIONS_ENABLED` | AI explanations for ops findings | `false` |
| `OPS_AI_MIN_SEVERITY` | Minimum severity to trigger AI explanations (`info`/`warn`/`critical`) | `warn` |

### Governance Exports (Block 6)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_GOV_EXPORTS` | Master switch for all governance export routes | `true` (ON by default) |
| `ENABLE_GOV_STUDENT_PII_EXPORT` | Allow PII fields in exports (requires platform-admin) | `false` |
| `ENABLE_GOV_NATIONAL_EXPORT` | National-aggregate export for platform admins | `true` (ON by default) |
| `ENABLE_GOV_AUDIT_SEARCH` | Audit log search + CSV export for admins | `true` (ON by default) |
| `ENABLE_GOV_CIRCUIT_BREAKER` | **Emergency kill switch** — disables all governance exports | `false` |

### AI Endpoints (Block 10)

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_TUTOR_ENABLED` | Student AI tutor (`POST /api/student/tutor`) | `false` |
| `AI_TEACHER_ASSIST_ENABLED` | Teacher support assistant (`POST /api/teacher/assist`) | `false` |
| `AI_TUTOR_DAILY_LIMIT` | Max AI tutor calls per user per day | `20` |
| `AI_TEACHER_ASSIST_DAILY_LIMIT` | Max teacher assist calls per teacher per day | `50` |

### Impact Analytics + Workflow Intelligence (Block 12)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_IMPACT_ANALYTICS` | Impact analytics dashboard routes | `false` |
| `ENABLE_IMPACT_SNAPSHOTS` | Persist ImpactSnapshot rows after each computation | `false` |
| `ENABLE_ASSIGNMENT_TUTOR` | AI tutor guidance in assignment context | `false` |
| `ENABLE_AI_GRADING_ASSIST` | AI-assisted grading feedback (advisory, teacher-controlled) | `false` |
| `ENABLE_INTERVENTION_ALERTS` | Class-level intervention alert engine | `false` |
| `ENABLE_AI_INTERVENTIONS` | AI interventions recommendation engine | `false` |
| `ENABLE_INTERVENTION_OUTCOMES` | Intervention outcomes resolution + dashboard | `false` |
| `AI_INTERVENTIONS_AI_ENHANCED` | AI augmentation for interventions (optional) | `false` |
| `ENABLE_DISTRICT_INTELLIGENCE` | District aggregate intelligence dashboards | `false` |

### Classroom Toolkit (Block 21)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_CLASSROOM_TOOLKIT` | Master gate for Classroom Toolkit | `false` |
| `ENABLE_TOOLKIT_CALCULATOR` | Calculator tools | `false` |
| `ENABLE_TOOLKIT_SCIENCE_TOOLS` | Science tools | `false` |
| `ENABLE_TOOLKIT_GEO_TOOLS` | Geometry tools | `false` |
| `ENABLE_TOOLKIT_TIMER` | Timer tool | `false` |
| `ENABLE_LONGITUDINAL_TRACKING` | Longitudinal growth tracking (monthly snapshots) | `false` |

### Predictive Analytics (Block 16)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_DROPOUT_RISK` | Dropout risk scoring routes | `false` |
| `AI_DROPOUT_RISK_ENABLED` | AI augmentation for dropout risk (advisory only) | `false` |
| `ENABLE_CURRICULUM_OPTIMIZATION` | National curriculum optimization loop | `false` |
| `ENABLE_CURRICULUM_OPTIMIZATION_AI` | AI advisory summaries for curriculum optimization | `false` |

### Geo + National Intelligence (Blocks 19–20)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_GEO_INTELLIGENCE` | National geo-performance aggregates (county-level) | `false` |
| `ENABLE_NATIONAL_INSIGHTS` | National insights dashboard aggregates | `false` |

### MOE Portal (Block 28)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_MOE_PORTAL` | MOE national oversight portal (5 routes) | `false` |
| `ENABLE_MOE_LOGIN_PORTAL` | Dedicated `/moe/login` entry point; when false `/moe/login` redirects to `/login` | `false` |
| `MOE_PORTAL_ALLOWLIST` | Comma-separated emails/domains allowed for MOE role. Empty = all. | `` (all) |

### User Flows

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_ENROLLMENT_INVITES` | Enrollment invite APIs (admin + teacher) | `false` |
| `ENABLE_ACCOUNT_RECOVERY` | Account recovery APIs (forgot/reset password) | `false` |
| `ENABLE_GUARDIAN_PORTAL` | Guardian portal (UI + APIs) | `false` |
| `ENABLE_GUARDIAN_LINKING` | Guardian linking APIs | `false` |
| `ENABLE_GUARDIAN_DASHBOARD` | Guardian dashboard + messaging routes (`/api/guardian/dashboard`, `/api/guardian/messages`) | `false` |
| `DEMO_MODE` | Demo mode master switch | `false` |

### AI Factory (Curriculum)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_CURRICULUM_FEEDBACK` | Structured telemetry on curriculum approval/rejection | `false` |

### Integrated Lesson Delivery Engine (Blocks 32A–32I)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_DELIVERY_PROFILE` | AI-generated delivery profile in curriculum content | `false` |
| `ENABLE_LESSON_DELIVERY_TRACKING` | Lesson delivery tracking on ScheduledWork | `false` |
| `ENABLE_AB_BLOCK_SCHEDULING` | A/B block day pair auto-creation | `false` |
| `ENABLE_UNIT_GROUPING` | Curriculum Unit grouping model + routes | `false` |
| `ENABLE_ASSIGNMENT_LESSON_LINKAGE` | Assignment/homework lesson linkage + auto-suggestions | `false` |
| `ENABLE_AI_ASSIGNMENT_GENERATION` | AI-assisted assignment draft generation | `false` |
| `ENABLE_TOOLKIT_LESSON_INTEGRATION` | Toolkit integration with lesson delivery | `false` |
| `ENABLE_VIRTUAL_LABS` | Virtual lab system (VirtualLab + LabSession routes) | `false` |
| `ENABLE_DELIVERY_COMPLIANCE_REPORTING` | MOE delivery compliance reporting | `false` |

---

## 6. Client-Side Feature Flags (NEXT_PUBLIC_)

Inlined at build time by Next.js. Set in `.env.local` or Vercel dashboard.

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING` | Guided onboarding flow | `false` |
| `NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE` | Accessibility mode UI | `false` |
| `NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL` | Guardian portal visibility in client | `false` |
| `NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES` | Enrollment invites visibility in client | `false` |
| `NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY` | Account recovery visibility in client | `false` |
| `NEXT_PUBLIC_ENABLE_TRAINING_CENTER` | Training Center (8 micro-modules) | `false` |
| `NEXT_PUBLIC_ENABLE_MASTERY_ENGINE` | Mastery Engine (strand taxonomy, per-student mastery) | `false` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (also used client-side) | — |

---

## 7. Recommended Minimum Production Configuration

```bash
# Core
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXTAUTH_URL="https://liberialearn.edu.lr"
NEXTAUTH_SECRET="<32-byte random>"

# AI
OPENAI_API_KEY="sk-..."
AI_BUDGET_MONTHLY_CAP_USD="150"

# Email
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@liberialearn.edu.lr"

# SMS (Africa's Talking)
AT_API_KEY="..."
AT_USERNAME="liberialearn"
AT_ENVIRONMENT="production"
AT_SENDER_ID="LRLEARN"

# Monitoring
SENTRY_DSN="https://...@sentry.io/..."
SENTRY_ORG="liberialearn"
SENTRY_PROJECT="liberialearn-web"
NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..."
SENTRY_AUTH_TOKEN="sntrys_..."

# AWS Export Storage
AWS_REGION="us-east-1"
AWS_S3_EXPORTS_BUCKET="liberialearn-exports-123456789012"

# Phase 1 MOE deployment flags
ENABLE_MOE_PORTAL="true"
ENABLE_AI_GRADING_ASSIST="true"
ENABLE_IMPACT_ANALYTICS="true"
ENABLE_GOV_EXPORTS="true"
NEXT_PUBLIC_ENABLE_MASTERY_ENGINE="true"
```

---

## 8. Notes

- **Never** commit real values for `NEXTAUTH_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL`, or any API key.
- Use Vercel's encrypted environment variable storage for all secrets.
- `DIRECT_URL` is required for `npx prisma migrate deploy` at deploy time; `DATABASE_URL` uses the pooler for runtime queries.
- Feature flags with `ENABLE_GOV_*` that default to `true` should be reviewed before first production deploy — set `ENABLE_GOV_STUDENT_PII_EXPORT=false` explicitly.
