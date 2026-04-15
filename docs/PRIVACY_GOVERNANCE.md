# Privacy Governance

## Principles
- Tenant isolation is mandatory.
- MOE endpoints expose aggregate data, not individual student records.
- Exports require explicit authorization.
- Access to sensitive data is logged.
- AI telemetry excludes raw prompt text and direct PII.

## Enforcement Points
- RBAC:
  - `requireRole()`
  - `requireUser()`
  - `requireMoeActor()`
  - `requireMoeExportUser()`
- Governance:
  - `ExportJobRequest`
  - `DataAccessLog`
  - `AuditLog`
- Privacy transforms:
  - `lib/exports/anonymize.ts`
  - `lib/moe/exportUtils.ts`

## Access Logging
- Governed export creation and download create `DataAccessLog` entries.
- Student passport reads create `DataAccessLog` entries.
- MOE dashboard and MOE export reads create `DataAccessLog` entries.
- Audit logging remains append-only and must never block the parent flow.

## Tenant Isolation Rules
- Analytics services must filter by `schoolId` when used in tenant-scoped contexts.
- Guardian access is limited to linked students.
- Students can only read their own passport.
- MOE access never drills into named student-level dashboard data.

## Telemetry Rules
- `AIInteraction.metadata` is sanitized.
- Blocked metadata classes include prompt text, message text, student identifiers, names, email, phone, and address fields.
- Stored telemetry focuses on counts, hashes, versions, models, cost, latency, and safe metadata.
