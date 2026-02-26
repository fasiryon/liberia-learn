# LiberiaLearn — Audit Gate 1: Architecture & RBAC Review
# After Block 13+14 (End of Phase 3)
# Conducted by: Engineering Lead
# Target: docs/audits/AUDIT_GATE_1.md

**Status:** PENDING
**Triggered after:** Block 13+14 merge
**Gate owner:** FA (Engineering Lead)
**Estimated time:** 2–4 hours
**Blocks until Gate 2:** ~14 blocks

---

## Purpose

Gate 1 is a human-eyes review of the full Phase 1–3 architecture before
predictive systems (Phase 4) are built on top of it. Fixing structural
issues now costs 10x less than fixing them after Phase 5.

This is not automated. Every item requires a human to verify.

---

## Section 1 — RBAC Matrix Verification

Verify every role has exactly the permissions it should.
Run the permissions test suite first, then manually spot-check.

```powershell
npx vitest run __tests__/permissions.test.ts __tests__/dashboard.access.test.ts __tests__/interventions.access.test.ts __tests__/district.access.test.ts
```

Then manually verify this matrix:

| Permission                  | School Admin | District Admin | National Admin | Teacher | Guardian |
|-----------------------------|:------------:|:--------------:|:--------------:|:-------:|:--------:|
| view:school:dashboard       | ✅ own only  | ✅ district    | ✅ any         | ❌      | ❌       |
| view:district:dashboard     | ❌           | ✅ own only    | ✅ any         | ❌      | ❌       |
| view:national:dashboard     | ❌           | ❌             | ✅             | ❌      | ❌       |
| view:school:trends          | ✅ own only  | ✅ district    | ✅ any         | ❌      | ❌       |
| view:district:trends        | ❌           | ✅ own only    | ✅ any         | ❌      | ❌       |
| view:school:interventions   | ✅ own only  | ✅ district    | ✅ any         | ❌      | ❌       |
| view:district:interventions | ❌           | ✅ own only    | ✅ any         | ❌      | ❌       |
| view:national:impact        | ❌           | ❌             | ✅             | ❌      | ❌       |
| AI tutor (student)          | ❌           | ❌             | ❌             | ❌      | ❌ (student only) |
| AI teacher assist           | ❌           | ❌             | ❌             | ✅      | ❌       |
| Assignment tutor            | ❌           | ❌             | ❌             | ✅      | ❌       |
| Grading assist              | ❌           | ❌             | ❌             | ✅      | ❌       |

**Check:** ☐ All rows verified against lib/permissions.ts
**Check:** ☐ No role has more permissions than the matrix above
**Check:** ☐ No undocumented permission strings in codebase

```powershell
# Find all permission strings in use
grep -rn "assertPermission\|hasPermission\|PERMISSION\|view:" --include="*.ts" . | grep -v node_modules | grep -v ".bak"
```

---

## Section 2 — Tenant Isolation Verification

Every database query that touches student, school, or report data
must be scoped by tenantId. No exceptions.

```powershell
# Find Prisma queries missing tenantId — review each result
grep -rn "prisma\." --include="*.ts" . | grep -v node_modules | grep -v "__tests__" | grep -v ".bak"
```

Manually check each query result:
- Does it include `where: { tenantId }` or equivalent?
- Is tenantId sourced from the server session (not request body)?
- Could a crafted request bypass tenant scoping?

**Check:** ☐ All Prisma queries in lib/ are tenant-scoped
**Check:** ☐ All Prisma queries in app/api/ are tenant-scoped
**Check:** ☐ tenantId never sourced from request body/params
**Check:** ☐ Cross-tenant test cases pass in all test suites

---

## Section 3 — Cross-District Isolation

District Admin must never see another district's data.
This is the most likely privilege escalation vector in Phase 3.

```powershell
npx vitest run __tests__/district.access.test.ts
```

Manually verify:
- `GET /api/admin/dashboard/district` with a district admin session
  for district B cannot return district A data
- `GET /api/admin/dashboard/district/interventions` same check
- districtId in API responses matches the requesting admin's district

**Check:** ☐ Cross-district test case explicitly tests district A vs district B
**Check:** ☐ districtId sourced from session for district admins (not query param)
**Check:** ☐ National admin can specify ?districtId= but district admin cannot

---

## Section 4 — PII Audit

No PII must appear in: API responses, telemetry events, AI prompts,
audit log payloads, or error messages.

PII includes: student names, teacher names, school names (in AI prompts),
studentId in metrics, phone numbers, email addresses in logs.

```powershell
# Search for potential PII leaks in telemetry calls
grep -rn "emitTelemetry\|logAudit" --include="*.ts" . | grep -v node_modules | grep -v ".bak"
```

For each telemetry/audit call, verify the payload contains no:
- studentId
- teacherId (raw — hashed is OK)
- name fields
- email or phone

```powershell
# Search AI prompt construction for PII risk
grep -rn "buildPrompt\|systemPrompt\|userPrompt\|messages:" --include="*.ts" . | grep -v node_modules
```

**Check:** ☐ No studentId in any telemetry payload
**Check:** ☐ No names in any AI prompt
**Check:** ☐ Teacher signals are one-way hashed (not raw IDs)
**Check:** ☐ Audit log payloads reviewed — no PII fields
**Check:** ☐ Error messages don't leak student/school data

---

## Section 5 — Data Flow Review

Verify the full data pipeline is intact and flows correctly:

```
Student attempt
  → AttemptLog (Block 8A)
  → processEvidence() (Block 7C)
  → StudentMasteryProfile (Block 7A)
  → Monthly reporting (Block 8)
  → MonthlySnapshot (Block 11)
  → School dashboard (Block 9)
  → District dashboard (Block 13+14)
  → National dashboard (Block 9)
  → Trend analytics (Block 11)
  → Impact engine (Block 12)
  → Intervention recommendations (Block 13+14)
```

**Check:** ☐ AttemptLog persists on every evidence submission
**Check:** ☐ Offline evidence replays correctly through processEvidence()
**Check:** ☐ Mastery profiles update after evidence replay
**Check:** ☐ Monthly snapshots reflect mastery profile state
**Check:** ☐ Dashboard reads from snapshots (not raw student data)
**Check:** ☐ Trend data is null (not zero) for missing months
**Check:** ☐ Impact engine uses monthly records as source (not raw students)
**Check:** ☐ Intervention scores are deterministic for same inputs

---

## Section 6 — Feature Flag Audit

All Phase 3 features must be OFF by default in production.
A misconfigured flag going live prematurely could expose
unfinished features to real schools.

```powershell
# List all feature flags
grep -rn "process.env.ENABLE_\|process.env.AI_" --include="*.ts" . | grep -v node_modules | sort
```

Verify each flag:

| Flag | Default | Behavior when OFF |
|------|---------|-------------------|
| ENABLE_PERFORMANCE_DASHBOARD | false | 404 |
| ENABLE_TREND_ANALYTICS | false | 404 |
| ENABLE_MONTHLY_SNAPSHOTS | false | live compute fallback |
| ENABLE_IMPACT_ANALYTICS | false | 404 |
| ENABLE_IMPACT_SNAPSHOTS | false | on-demand compute |
| ENABLE_AI_INTERVENTIONS | false | 404 |
| AI_INTERVENTIONS_AI_ENHANCED | false | deterministic only |
| ENABLE_DISTRICT_INTELLIGENCE | false | 404 |
| AI_TUTOR_ENABLED | false | 404 |
| AI_TEACHER_ASSIST_ENABLED | false | 404 |
| ENABLE_ASSIGNMENT_TUTOR | false | 404 |
| ENABLE_AI_GRADING_ASSIST | false | 404 |
| ENABLE_INTERVENTION_ALERTS | false | 404 |

**Check:** ☐ All flags above confirmed default OFF in serverFlags.ts
**Check:** ☐ No flag returns 403 when off — must be 404
**Check:** ☐ Vercel/production env vars reviewed — no Phase 3 flags enabled

---

## Section 7 — Offline-First Regression Check

Phase 3 must not have broken offline functionality from Phase 2.

```powershell
npx vitest run __tests__/offline.evidence.test.ts __tests__/offline.sync.evidence.test.ts __tests__/offline-queue.test.ts __tests__/offline-cache-session.test.ts
```

**Check:** ☐ All offline tests pass
**Check:** ☐ Evidence queue still processes entity="evidence" correctly
**Check:** ☐ AttemptLog idempotency keys still prevent duplicates
**Check:** ☐ Sync route still replays in chronological order

---

## Section 8 — Full Test Suite

Run the complete test suite. Zero failures required to pass Gate 1.

```powershell
npm test
```

Expected: all test files pass, zero failures.

**Check:** ☐ Test count matches or exceeds last known count (487+)
**Check:** ☐ Zero failures
**Check:** ☐ No skipped tests hiding failures
**Check:** ☐ No snapshot-only tests masking real assertions

---

## Section 9 — ADR Completeness

Every major architectural decision in Phase 3 must have an ADR.

```powershell
ls docs/adr/
```

Verify these ADRs exist:
- 0010 or higher — Performance Dashboard
- AI Stabilization policy
- Trend data strategy
- Impact and workflow loop
- Interventions and district layer

**Check:** ☐ All Phase 3 ADRs present
**Check:** ☐ Each ADR includes: Status, Date, Block, Decision, Rationale, Rejected Alternatives
**Check:** ☐ ROADMAP_BLOCKS.md is committed and current

---

## Gate 1 Sign-Off

Complete all checks above before starting Phase 4 (Block 14 onward).

| Section | Status | Notes |
|---------|--------|-------|
| 1. RBAC Matrix | ☐ | |
| 2. Tenant Isolation | ☐ | |
| 3. Cross-District Isolation | ☐ | |
| 4. PII Audit | ☐ | |
| 5. Data Flow | ☐ | |
| 6. Feature Flags | ☐ | |
| 7. Offline Regression | ☐ | |
| 8. Full Test Suite | ☐ | |
| 9. ADR Completeness | ☐ | |

**Gate 1 passed:** ☐ YES / ☐ NO
**Date completed:**
**Issues found:**
**Issues resolved before Phase 4:**

---

## If Issues Are Found

Minor issues (test fix, missing ADR, flag misconfiguration):
→ Fix on main directly, document in this file, proceed to Phase 4.

Major issues (tenant leakage, cross-district access, PII exposure):
→ Create a hotfix branch, fix, re-run full test suite, re-audit
  affected sections before proceeding.

Do not start Phase 4 with unresolved major issues.
## Status
Current Sprint: main
Date: 2026-02-26
Owner: Fasiryon
Result: PASS
Counts: PASS 8  WARN 0  FAIL 0
Score: 100%
Report: docs\audits\AUDIT_GATE_1_REPORT_20260226.md

