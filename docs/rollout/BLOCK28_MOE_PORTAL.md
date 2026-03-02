# Block 28 — MOE Access Portal

**Date:** 2026-03-01
**Status:** ACCEPTED
**Test files:** `__tests__/moe-portal.test.ts`
**Total new tests:** 29
**Suite total after Block 28:** 900 / 900 PASS

---

## 1. Overview

Block 28 delivers the Ministry of Education (MOE) national oversight portal: a new `MOE_OFFICIAL` role and five read-only API routes that expose aggregated platform-wide data for MOE officials. All routes return anonymized aggregates — no PII, no individual student or teacher identifiers.

---

## 2. Schema Change — MOE_OFFICIAL Role

### 2.1 Prisma schema

Added `MOE_OFFICIAL` to the `Role` enum in `prisma/schema.prisma`:

```prisma
enum Role {
  TEACHER
  STUDENT
  GUARDIAN
  ADMIN
  DISTRICT_ADMIN
  MOE_OFFICIAL     ← new
}
```

### 2.2 Migration

`prisma/migrations/20260301_000001_moe_official_role/migration.sql`

```sql
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MOE_OFFICIAL';
```

The `IF NOT EXISTS` guard makes the migration safe for idempotent re-runs. PostgreSQL 12+ allows `ALTER TYPE ADD VALUE` outside a transaction block.

### 2.3 TypeScript type update

`lib/auth.ts` — `SessionUser.role` union updated:

```typescript
role: "STUDENT" | "TEACHER" | "ADMIN" | "GUARDIAN" | "DISTRICT_ADMIN" | "MOE_OFFICIAL";
```

---

## 3. Feature Flag

`ENABLE_MOE_PORTAL` — already present in `lib/serverFlags.ts` (Block RR-4):

```typescript
export function isMoePortalEnabled(): boolean {
  return process.env.ENABLE_MOE_PORTAL === "true";
}
```

All five routes check this flag first and return `404` when it is off. This provides a clean circuit breaker for MOE portal rollout.

---

## 4. Routes

All routes live under `app/api/moe/` and share the same access control pattern:

1. `isMoePortalEnabled()` → 404 if off
2. `requireUser()` → 401 if unauthenticated
3. `user.role === "MOE_OFFICIAL" || user.isPlatformAdmin` → 403 if neither
4. Query Prisma for aggregated, anonymized data
5. `logAudit(...)` — fire-and-forget
6. Return JSON

### 4.1 `GET /api/moe/dashboard`

**File:** `app/api/moe/dashboard/route.ts`

National summary dashboard. Six parallel Prisma count queries:

| Field | Source |
|-------|--------|
| `schools` | `school.count()` |
| `districts` | `district.count()` |
| `students` | `student.count()` |
| `scheduledWork.total` | `scheduledWork.count()` |
| `scheduledWork.delivered` | `scheduledWork.count({ where: { isDelivered: true } })` |
| `interventionsLast30Days` | `interventionLog.count({ where: { generatedAt: { gte: 30daysAgo } } })` |

Computed: `deliveryRatePct = delivered / total × 100` (rounded to 2dp, null if no data).

**Audit action:** `MOE_DASHBOARD_VIEW`

### 4.2 `GET /api/moe/standards-coverage`

**File:** `app/api/moe/standards-coverage/route.ts`

National MOE standard coverage by subject and grade band. Parallel queries:
- `curriculumContent.findMany({ where: { status: { in: ["published", "accepted"] } } })`
- `standard.findMany()`

Builds a `Set<string>` of covered standard codes from `moeAlignments.standards[].code`, then groups by `subject-band` to produce per-group coverage percentages.

**Audit action:** `MOE_STANDARDS_COVERAGE_VIEW`

### 4.3 `GET /api/moe/delivery-compliance`

**File:** `app/api/moe/delivery-compliance/route.ts`

Lesson delivery compliance rates aggregated by district. Fetches districts with nested schools → classes → scheduledWork. Computes per-district and national totals/delivered/compliancePct. No school names or IDs are emitted in the output — only `districtId`, `districtName`, `region`, `schoolCount`, and count/rate fields.

**Audit action:** `MOE_DELIVERY_COMPLIANCE_VIEW`

### 4.4 `GET /api/moe/curriculum-health`

**File:** `app/api/moe/curriculum-health/route.ts`

Curriculum alignment health: total published/accepted content items, how many have `moeAlignments` set, broken down by subject. No individual lesson IDs or titles are returned.

**Audit action:** `MOE_CURRICULUM_HEALTH_VIEW`

### 4.5 `GET /api/moe/intervention-impact`

**File:** `app/api/moe/intervention-impact/route.ts`

Intervention outcome effectiveness aggregated by district. Reads `outcomeDelta` and `outcomeEffectSize` from `InterventionLog` records, computes district-level and national averages. `growthRiskFlag` counts are included. No `schoolId`, `tenantId`, or individual log IDs are emitted.

**Audit action:** `MOE_INTERVENTION_IMPACT_VIEW`

---

## 5. Access Control Summary

| Role | Access |
|------|--------|
| `MOE_OFFICIAL` | ✅ All 5 routes |
| `isPlatformAdmin = true` | ✅ All 5 routes |
| `ADMIN` (non-platform) | ❌ 403 |
| `TEACHER` | ❌ 403 |
| `STUDENT` | ❌ 403 |
| `DISTRICT_ADMIN` | ❌ 403 |
| Unauthenticated | ❌ 401 (from `requireUser`) |
| Flag off (`ENABLE_MOE_PORTAL != "true"`) | ❌ 404 |

---

## 6. Privacy Guarantees

All five routes enforce the following privacy contract:

- **No PII**: no student names, teacher names, emails, or guardian phone numbers in any response
- **No individual identifiers**: student IDs, teacher IDs, and class IDs are not returned
- **Aggregation only**: all data is count/average/percentage at district or national level
- **Audit trail**: every successful access is written to `AuditLog` with `userId` and action name

---

## 7. Test Coverage (`__tests__/moe-portal.test.ts` — 29 tests)

| Describe block | Tests | Coverage |
|----------------|-------|----------|
| Flag guard | 5 | All 5 routes return 404 when `ENABLE_MOE_PORTAL` is off |
| Role guard | 5 | TEACHER gets 403 on all 5 routes |
| MOE_OFFICIAL access | 5 | All 5 routes return 200 with correct fields |
| isPlatformAdmin access | 5 | All 5 routes return 200 for platform admins |
| No PII | 3 | Dashboard, delivery-compliance, intervention-impact bodies verified PII-free |
| Audit logging | 6 | Each route logs correct action; no audit log on 403 |

**All 29 tests pass.**

---

## 8. MOE National Deployment Note

> The Block 28 MOE Access Portal provides Ministry of Education officials with a secure, read-only window into national platform health metrics. All data is pre-aggregated and anonymized — individual student or teacher records are never accessible through these routes. The `ENABLE_MOE_PORTAL` flag allows staged rollout to verified MOE domains, with `isPlatformAdmin` override for platform engineering support.
>
> **Block 28 — ACCEPTED**
