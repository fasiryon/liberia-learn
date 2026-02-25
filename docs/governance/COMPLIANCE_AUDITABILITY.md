# Compliance & Auditability (V2 — Block 6)

## Audit Logging

Every critical action must log via `logAudit()` from `lib/audit.ts`:

| Field | Required | Description |
|-------|----------|-------------|
| `userId` | Yes (when authenticated) | Who performed the action |
| `action` | Yes | Dot-namespaced action string (e.g. `export.student_performance`) |
| `schoolId` | Yes (for all tenant actions) | Tenant ID for scoped queries |
| `traceId` | Yes (Block 6+) | UUID generated at route entry, passed to all logAudit() calls in the same request |
| `resourceType` | Recommended | Category of affected resource (e.g. `export`, `school`, `user`) |
| `resourceId` | Recommended | ID of the affected record |
| `details` | Recommended | Structured metadata (no PII) |
| `ipAddress` | Optional | Source IP address |

### Action Naming Convention

```
{domain}.{entity}.{verb}
```

Examples:
- `export.student_performance`
- `export.training.summary`
- `compliance.audit_log.exported`
- `school.settings.updated`

### Trace IDs (Block 6)

Every governance API route generates a `traceId = randomUUID()` at the entry
point and passes it to all `logAudit()`, `recordMetricEvent()`, and downstream
calls within that request. This enables:

- Correlating all audit entries from one admin action
- Reconstructing the full sequence of events during incident investigation
- Differentiating two identical actions made milliseconds apart

```typescript
// Pattern in governance routes
const traceId = randomUUID();
// ... process request ...
await logAudit({ userId, action, schoolId, traceId, ... });
```

### schoolId Propagation

All `logAudit()` calls for tenant-scoped actions must pass `schoolId: user.schoolId`.
This ensures:
- Compliance UI (`/admin/compliance`) can filter by school
- Platform admins can view cross-school audit entries by school
- Audit log exports are correctly scoped for tenant admins

### Implementation

```typescript
// lib/audit.ts
export async function logAudit({
  userId, action, resourceType, resourceId,
  details, ipAddress,
  traceId,   // Block 6: request correlation
  schoolId,  // Block 6: tenant scoping
}: { ... }): Promise<void>
```

The function is non-throwing — audit failures log to `console.error` but
never break the main request flow.

## Compliance View

Accessible at `/admin/compliance`.

Features:
- **Audit log search**: filter by action, date range, resource type
- **Pagination**: 50 entries per page
- **CSV export**: download filtered audit log as spreadsheet (requires `COMPLIANCE_AUDIT_EXPORT` permission)
- **Export history**: last 10 data downloads with type, scope, format
- **Keyboard accessible**: all filters via native form, no JS required
- **Escape hatch**: ← Back to Admin Console link

## Messaging Compliance

- opt-in/out tracked via `GuardianConsent`
- quiet hours enforced in SMS delivery pipeline
- per-guardian throttles (configurable via `SMS_THROTTLE_*` env vars)
- school-level policies configurable

## AI Auditability

For all AI-generated content:
- `promptHash` (SHA-256) stored in `OpsExplanation.promptHash` — raw prompt not stored
- `modelUsed` recorded
- Output is advisory only — never auto-applied
- All AI calls require manual admin trigger (no auto-explain)

## Critical Actions Requiring Audit Logs

| Action | Log Required | Notes |
|--------|-------------|-------|
| Login / Logout | ✅ | |
| Homework submit | ✅ | |
| Lesson view | ✅ | |
| School settings changed | ✅ | |
| Export: any type | ✅ | Creates ExportRecord + AuditLog |
| Audit log exported | ✅ | Meta-audit |
| Guardian opt-out | ✅ | |
| SMS sent / failed | ✅ | Via SMSDeliveryLog |
| AI explanation requested | ✅ | Block 5 |
| Ops finding acknowledged | ✅ | Block 5 |
| Feature flag changed | ✅ | (To be implemented in V3) |
