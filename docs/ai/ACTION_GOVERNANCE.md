# Action Governance

## Risk Levels

- `low`: read-only insights, internal reminders, dashboard annotations.
- `medium`: teacher-facing intervention drafts, guardian message drafts, curriculum improvement drafts, workflow reassignment suggestions.
- `high`: live guardian messaging, bulk scheduling, curriculum publication, school operations changes, export generation.
- `critical`: student placement, retention, promotion, discipline, national policy action, raw PII disclosure.

## Approval Matrix

| Risk | Default Policy | Approver |
| --- | --- | --- |
| Low | May be autonomous after pilot evidence | domain owner or configured policy |
| Medium | Approval required | teacher, admin, or platform admin |
| High | Approval required plus audit review | platform admin or MOE-authorized official |
| Critical | Prohibited by default | explicit governance authorization only |

## Rollback Handling

Every write action must define:

- whether rollback is possible
- rollback operation
- compensating event
- audit trail
- operator owner

If rollback is not possible, the action is automatically high or critical risk.

## Escalation Policies

Escalate on conflicting evidence, repeated failures, excessive retries, cost spikes, low confidence, tenant ambiguity, approval timeout, or kill switch activation.

## Audit Requirements

Action governance requires both domain and governance traces:

- `LearningEvent` for education workflow trace.
- `AuditLog` for security/governance trace.
- `AIInteraction` when AI contributed.
- Approval record for medium/high risk.

## Execution Policies

- Execute through existing domain services.
- Revalidate authorization at execution time.
- Revalidate feature flags and kill switches at execution time.
- Use idempotency keys.
- Persist outcome and error category.

## Autonomy Rate Limiting

Apply limits by tenant, agent, action type, user, and global system capacity. Live communication and DB-heavy actions need stricter limits than read-only insights.
