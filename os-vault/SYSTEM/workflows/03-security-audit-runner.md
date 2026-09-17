# Workflow: Security Audit Runner
# Trigger: Manual QUEUE drop — AUDIT-[scope]-[date].md
# Output: GENERATED/reports/YYYY-MM-DD-security-audit-[scope].md

## Instructions for Claude

Read `SYSTEM/CLAUDE.md` and the QUEUE file to determine the exact audit scope:
auth, PII, database, infrastructure, or an explicitly requested full audit.
Inspect only the selected scope and directly related guards or callers.

LiberiaLearn-specific security context:
- Tenant-owned reads and writes must enforce the caller's governed scope.
- Secrets must come from approved secret storage with no runtime fallback.
- Password reset tokens must be stored and queried by a non-reversible hash.
- Sensitive and cost-bearing endpoints require appropriate abuse controls.
- Child PII must not enter AI prompts, logs, or national aggregate views.
- Treat prior audit claims as hypotheses until current code or live evidence
  verifies them.

### AUTH AUDIT
Read: app/api/auth/*, middleware.ts, lib/auth.ts, lib/permissions.ts, lib/serverFlags.ts
Check for:
- [ ] Session tokens properly invalidated on logout
- [ ] Password reset tokens are single-use, expire, queried by tokenHash only
- [ ] Auth routes protected against brute force (rate limits via @upstash/ratelimit)
- [ ] JWT_SECRET loaded from env — no fallback or default value
- [ ] Role checks happen server-side (requireRole pattern), not client-only
- [ ] Admin routes inaccessible to non-admin roles
- [ ] MOE_OFFICIAL role properly separated from school ADMIN role
- [ ] isPlatformAdmin flag not grantable by non-platform-admin
- [ ] mustChangePIN flow enforced for relevant roles

### PII AUDIT
Read: lib/ai/*, app/api/student/tutor, app/api/teacher/grading, app/api/homework/*
Check for:
- [ ] Student names/emails never appear in raw Claude/OpenAI API prompts
- [ ] PII not logged to Sentry or console in plain text
- [ ] User data not exposed in error messages
- [ ] MOE API routes return zero student PII (aggregate only)
- [ ] API responses don't leak fields not requested by client
- [ ] guardian SMS notifications: phone numbers stored in E.164 format, not exposed in logs

### DATABASE AUDIT
Read: All Prisma query files in lib/, app/api/
Check for:
- [ ] EVERY query touching tenant data includes schoolId WHERE clause
- [ ] No raw SQL queries bypassing tenant scoping
- [ ] No N+1 queries in list endpoints (check districtAggregator, dashboardAggregator)
- [ ] Sensitive fields (hashedPwd, tokenHash) never returned in API responses
- [ ] Prisma migrations are additive (no DROP without backup step)
- [ ] DATABASE_URL and DIRECT_URL are env variables (never hardcoded)
- [ ] CurriculumContent embedding field not accidentally serialized

### INFRASTRUCTURE AUDIT
Read: .github/workflows/*, next.config.js, vercel.json if present
Check for:
- [ ] No secrets hardcoded in GitHub Actions workflows
- [ ] Sentry DSN is env variable (NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN)
- [ ] CRON_SECRET is set and verified on cron routes
- [ ] Content-Security-Policy header present in next.config.js headers()
- [ ] ENABLE_GOV_CIRCUIT_BREAKER pattern available for emergency export shutdown
- [ ] AI_BUDGET_MONTHLY_CAP_USD enforced (prevents unbounded AI spend)
- [ ] TTS_MONTHLY_CAP_USD enforced
- [ ] ENABLE_GOV_STUDENT_PII_EXPORT defaults false

### Output Format

---
# Security Audit — [SCOPE] — {TODAY'S DATE}

## Executive Summary
**Overall risk level:** [Critical / High / Medium / Low]
**Issues found:** [count by severity]
**Immediate actions required:** [P0 items only]

## Findings

### P0 — Critical (Fix before any deployment)
[List with file path, line number, description, exact fix required]

### P1 — High (Fix within current sprint)
[List with file path, description, recommended fix]

### P2 — Medium (Fix within 2 sprints)
[List with description]

### Passed Checks ✅
[List every check that passed — be specific]

## Recommended Next Steps
1. [Immediate action if P0s exist]
2. [This week]
3. [This sprint]

---
*Generated: {TIMESTAMP} | P0 findings require immediate human review*
---

Save file. If P0 findings exist, create GENERATED/briefings/URGENT-{date}-security.md with P0 items only.
Log the write to SYSTEM/logs/operations.md.
