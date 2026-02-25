# Permissions Matrix (V2 — Block 6)

> **This document is authoritative.** The code implementation in
> `lib/permissions.ts` must stay in sync with this matrix.
> Any change here must be reflected in the code and tests.

## Roles

| Role | Description |
|------|-------------|
| `ADMIN` | School administrator. Manages one school. Has school-scoped governance access. |
| `TEACHER` | Creates and grades lessons/assignments for their classes. |
| `STUDENT` | Views and submits daily work. |
| `GUARDIAN` | Receives SMS notifications; optionally views student progress. |
| `SCHOOL_CHAMPION` | (Optional) Elevated teacher with onboarding/training oversight. No tenant admin access. |
| **Platform Admin** | Not a separate role. Identified by `isPlatformAdmin=true` on the `User` record. Bypasses all role checks. Has national-scope access. |

## Core Principles

1. **Least privilege** — default deny; all permissions are explicit allow-lists
2. **Tenant-scoped** — ADMINs can only access data for their own school
3. **Platform Admin bypass** — `isPlatformAdmin=true` grants all permissions
4. **All privileged actions audited** — every export and compliance action creates an `AuditLog` entry with `traceId` for request correlation
5. **PII safe by default** — aggregate-only exports unless `GOVERNANCE_EXPORT_PII` + flag enabled

## Permissions Reference

Permissions are defined as constants in `lib/permissions.ts`:

```typescript
PERMISSIONS = {
  COMPLIANCE_AUDIT_READ,     // "compliance:audit_log:read"
  COMPLIANCE_AUDIT_EXPORT,   // "compliance:audit_log:export"
  GOVERNANCE_EXPORT_SCHOOL,  // "governance:export:school"
  GOVERNANCE_EXPORT_NATIONAL,// "governance:export:national"   — platform admin only
  GOVERNANCE_EXPORT_PII,     // "governance:export:pii"        — platform admin + flag
  SCHOOL_SETTINGS_WRITE,     // "school:settings:write"
  SCHOOL_BRANDING_WRITE,     // "school:branding:write"
  TRAINING_ADOPTION_READ,    // "training:adoption:read"
  OPS_FINDINGS_READ,         // "ops:findings:read"
  OPS_FINDINGS_MANAGE,       // "ops:findings:manage"
  OPS_AI_EXPLAIN,            // "ops:ai_explain"
}
```

## Permission Matrix

| Permission | ADMIN | TEACHER | STUDENT | GUARDIAN | Platform Admin |
|-----------|:-----:|:-------:|:-------:|:--------:|:--------------:|
| `compliance:audit_log:read` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `compliance:audit_log:export` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `governance:export:school` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `governance:export:national` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `governance:export:pii` | ❌ | ❌ | ❌ | ❌ | ✅\* |
| `school:settings:write` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `school:branding:write` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `training:adoption:read` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `ops:findings:read` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `ops:findings:manage` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `ops:ai_explain` | ✅ | ❌ | ❌ | ❌ | ✅ |

\* PII export also requires `ENABLE_GOV_STUDENT_PII_EXPORT=true` server flag.

## Governance Export Scope Rules

| Scope | ADMIN | Platform Admin | Flag Required |
|-------|:-----:|:--------------:|:-------------:|
| `school` (own school) | ✅ | ✅ | `ENABLE_GOV_EXPORTS` (default ON) |
| `school` (another school) | ❌ | ✅ | — |
| `national` | ❌ | ✅ | `ENABLE_GOV_NATIONAL_EXPORT` (default ON) |

**Tenant enforcement:** `lib/reporting/scope.ts#resolveScopeParams()` throws 403
if a non-platform-admin provides a `scopeId` that differs from `user.schoolId`.

## Forbidden Paths (Tested)

The following are verified by `__tests__/permissions.test.ts`:

- TEACHER cannot call any governance or compliance endpoint
- STUDENT cannot call any governance or compliance endpoint
- GUARDIAN cannot call any governance or compliance endpoint
- ADMIN cannot request national-scope exports
- ADMIN cannot export PII even if requested
- Unknown roles are denied all permissions

## Route Handler Pattern

```typescript
// Standard pattern in every governance route
const user = await requireRole("ADMIN");          // 401/403 if not authenticated/authorized
assertPermission(user, PERMISSIONS.SOME_PERM);    // 403 if role lacks permission

// For elevated operations, check isPlatformAdmin separately
if (scope === "national") {
  assertPermission(user, PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL);
}
```

## Adding New Permissions

1. Add the constant to `PERMISSIONS` in `lib/permissions.ts`
2. Add it to the appropriate role's set in `ROLE_PERMISSIONS`
3. Update this matrix table
4. Add test cases to `__tests__/permissions.test.ts`
5. Reference the permission with `assertPermission(user, PERMISSIONS.X)` in route handlers
