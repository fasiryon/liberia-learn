# Data Governance (V2 — Block 6)

## Ownership
Schools own their data. LiberiaLearn is the processing platform.

## Export Standards (Block 6)

All exports are:
- **PII-free by default** — aggregate counts and rates only; no names, phones, or IDs
- **Tenant-scoped** — school admins receive only their school's data
- **Audited** — every export creates an `ExportRecord` + `AuditLog` entry with a `traceId`
- **Dual-format** — JSON (machine-readable) and CSV (spreadsheet) supported

### Export Types

| Export Type | Description | Default Scope | PII |
|-------------|-------------|---------------|-----|
| `student_performance` | Enrollment counts, homework completion rates, lesson views per school | School | Never (aggregate only) |
| `class_summary` | Class count, avg students/class, homework submission rates per school | School | Never |
| `monthly_report` | Month-window summary: enrollment, activity, SMS, training, exports, audit events | School | Never |
| `training_summary` | Training module completion rates per school | School | Never |

### Export API Routes

```
GET /api/admin/governance/exports/student-performance?scope=school&scopeId=...&format=csv
GET /api/admin/governance/exports/class-summary?scope=school&scopeId=...&format=csv
GET /api/admin/governance/exports/monthly-report?scope=school&scopeId=...&yearMonth=YYYY-MM&format=csv
GET /api/admin/training/export?scope=school&scopeId=...&format=csv
```

### National Aggregates (Platform Admin Only)
Platform admins (MOE-level) can add `scope=national` to any export route.
Requires `ENABLE_GOV_NATIONAL_EXPORT=true` (default ON) and `isPlatformAdmin=true`.

### PII Export Authorization
PII fields in exports are explicitly out of scope for V2.
To enable in future:
1. Obtain institutional authorization (MOE policy decision)
2. Enable `ENABLE_GOV_STUDENT_PII_EXPORT=true` on the server
3. The requesting user must hold `GOVERNANCE_EXPORT_PII` permission (platform admin only)
4. Every PII export must be logged with enhanced audit details

### No Public Ranking Dashboards
Per MOE governance policy, no school rankings, league tables, or comparative
performance dashboards are publicly accessible. All exports are private to
authenticated administrators.

## Compliance Audit Log

The `AuditLog` table records every significant administrative action.

**Key fields:**
- `action` — what happened (e.g., `export.student_performance`, `compliance.audit_log.exported`)
- `userId` — who did it
- `schoolId` — which school's data was affected (tenant isolation)
- `traceId` — UUID correlating all log entries from a single request
- `resourceType` / `resourceId` — what resource was affected

**Search UI:** `/admin/compliance` — paginated search with action/date filters, CSV download

## Retention

| Data Category | Recommended Retention |
|---------------|----------------------|
| Student records | Indefinite while school is active; archive on offboarding |
| Audit logs | Minimum 2 years |
| SMS delivery logs | Minimum 1 year |
| Export records | Minimum 1 year |
| AI artifacts | 90 days unless archived by school |

*(Exact durations are policy decisions for MOE; the system supports configuring retention periods.)*

## Deletion

| Operation | Status |
|-----------|--------|
| Student deletion (policy-bound) | V3 scope |
| Guardian phone removal | Supported via `GuardianConsent.optedOutAt` |
| School offboarding workflow | V3 scope |

## Offboarding Protocol
When a school leaves:
1. Download final archive (student_performance, class_summary, training_summary)
2. Revoke admin access (set `school.status = "INACTIVE"`)
3. Export and archive audit logs
4. Follow deletion/retention policy for personal data
5. Produce offboarding report

## Audits
Every download is tracked. Administrators can view:
- "Who downloaded what" at `/admin/compliance`
- Export history at `/admin/governance/exports`
- Download CSV of audit log for evidence in compliance reviews
