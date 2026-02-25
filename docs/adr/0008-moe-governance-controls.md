# ADR 0008 — MOE Governance & National Controls

## Status
Accepted

## Context
LiberiaLearn is entering national rollout. The Ministry of Education (MOE) requires:
- Evidence that all administrative actions are logged and traceable
- Safe, auditable data exports for school administrators and MOE analysts
- A codified permissions model that can be verified in tests
- Emergency controls (kill switches) for governance features
- No public ranking dashboards; aggregate-only exports by default

The existing audit log had no request-correlation identifier, `schoolId` was in the
DB schema but not propagated from the `logAudit()` call site, and there was no unified
permissions enforcement layer — role checks were scattered across route files.

## Decisions

### 1. Permissions-as-Code (`lib/permissions.ts`)
We introduced a single `PERMISSIONS` constant and `ROLE_PERMISSIONS` map that
mirrors `docs/governance/PERMISSIONS_MATRIX.md`. All governance route handlers call
`assertPermission(user, PERMISSIONS.X)` immediately after `requireRole()`.

**Rationale:** A permissions matrix that only exists in a markdown file cannot be
tested. By encoding it in TypeScript, we can write deterministic tests for every
role × permission combination, including forbidden paths.

**Consequences:** Any new feature that requires a permission must add an entry to
`PERMISSIONS` and the appropriate `ROLE_PERMISSIONS` sets. This is enforced by code
review.

### 2. Trace IDs for Request Correlation
Every governance API route generates a `traceId = randomUUID()` at the entry point
and passes it to `logAudit()`. The `AuditLog.traceId` column is indexed for fast
lookups during incident investigations.

**Rationale:** Without a trace ID, correlating multiple audit log entries from a
single admin action (e.g., an export that creates an ExportRecord and an AuditLog
entry) requires comparing timestamps, which is unreliable. A UUID trace ID makes
correlation unambiguous.

**Consequence:** Added `traceId String?` to `AuditLog` schema + migration
`20260224_000003_add_audit_trace_id`. Existing rows have `traceId = NULL`; this is
safe because null means "pre-Block 6 entry" not "unknown".

### 3. `logAudit()` schoolId Propagation
The `logAudit()` function signature now accepts an optional `schoolId` parameter.
All governance actions pass `schoolId: user.schoolId` to ensure every audit entry
is correctly tenant-scoped.

**Rationale:** The `AuditLog.schoolId` column existed but was never populated from
`logAudit()`. This made tenant-scoped audit queries return empty results, defeating
the compliance UI.

**Backward compatibility:** The parameter is optional; all existing callers continue
to compile without changes. New callers are encouraged to pass `schoolId`.

### 4. PII-Safe Export Defaults
All three new export types (student performance, class summary, monthly report)
produce aggregate counts only. No student names, teacher names, phone numbers,
or individual identifiers are included by default.

The `ENABLE_GOV_STUDENT_PII_EXPORT` server flag must be explicitly set to `"true"`
AND the caller must hold `GOVERNANCE_EXPORT_PII` permission (platform admin only)
to receive PII fields. This flag defaults to `false` (safe by default).

**Rationale:** The spec states "Aggregates safe by default" and "No public ranking
dashboards." PII exports require explicit institutional authorization.

### 5. National Exports (Platform Admin Only)
Exports with `scope=national` require `GOVERNANCE_EXPORT_NATIONAL` permission, which
is NOT in the `ADMIN` role's permission set. Only `isPlatformAdmin=true` users can
access national aggregates, AND the `ENABLE_GOV_NATIONAL_EXPORT` flag must be on.

**Rationale:** Prevents a school administrator from accidentally (or maliciously)
downloading data for all schools by changing a URL parameter.

### 6. Feature Flag Circuit Breakers
Three individual flags control governance subsystems:
- `ENABLE_GOV_EXPORTS` — master switch for all export routes
- `ENABLE_GOV_NATIONAL_EXPORT` — national-scope exports
- `ENABLE_GOV_AUDIT_SEARCH` — audit log search and CSV download

One emergency circuit breaker overrides all of them:
- `ENABLE_GOV_CIRCUIT_BREAKER=true` — disables the entire governance subsystem
  and returns `503 governance_disabled`

**Rationale:** During a security incident, a single environment variable change can
disable all governance data access without a code deploy.

### 7. No Autonomous Governance Actions
The governance layer is strictly read-and-export. It never:
- Modifies school settings or user records
- Sends messages or notifications
- Applies feature flags automatically based on export data

All data is advisory/informational only.

## Consequences

**Positive:**
- Governance permissions are testable: 3 test files, ~70 tests
- Audit entries are request-traceable via `traceId`
- Export history is visible to admins in the compliance UI
- Emergency kill switch (`ENABLE_GOV_CIRCUIT_BREAKER`) is operationally safe
- PII is off by default (safe deployment posture)

**Negative:**
- Adding a new governance permission requires changes to both `lib/permissions.ts`
  and `docs/governance/PERMISSIONS_MATRIX.md`
- The national export scoping adds one extra round-trip (platform admin check)
- `logAudit()` calls across the codebase should be updated to pass `schoolId`
  (legacy calls with `schoolId: undefined` still work but produce un-scoped entries)

## Alternatives Considered and Rejected

| Alternative | Reason for Rejection |
|-------------|----------------------|
| Inline role checks in each route handler | Not testable as a matrix; drift-prone |
| Separate `PLATFORM_ADMIN` role in Prisma enum | Schema migration + enum change in production; `isPlatformAdmin` boolean is simpler and already exists |
| Auto-generate export at scheduled intervals | Complicates multi-tenant deployment; creates stale data concerns |
| Public read-only ranking dashboards | Explicitly prohibited by MOE governance requirements |

## Related
- `lib/permissions.ts` — permissions matrix implementation
- `lib/serverFlags.ts` — circuit breaker and governance flag implementations
- `lib/exports/governanceExport.ts` — export builders
- `app/api/admin/compliance/audit-log/route.ts`
- `app/api/admin/governance/exports/`
- `docs/governance/PERMISSIONS_MATRIX.md`
- `docs/ops/FEATURE_FLAGS.md` (governance flags section)
