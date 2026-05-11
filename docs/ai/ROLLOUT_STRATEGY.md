# Rollout Strategy

## Feature Flag Rollout

Every autonomous subsystem must have server-side flags. Client flags may reveal UI but must not be the only enforcement mechanism.

Recommended flags:

- `ENABLE_AUTONOMOUS_OS`
- `ENABLE_AUTONOMOUS_WORKFLOWS`
- `ENABLE_AGENT_DETECTION`
- `ENABLE_AGENT_RECOMMENDATIONS`
- `ENABLE_AGENT_ACTION_APPROVALS`
- `ENABLE_LOW_RISK_AUTONOMY`
- `ENABLE_AUTONOMOUS_MEMORY`
- `ENABLE_AUTONOMOUS_OPTIMIZATION`

## Tenant Rollout Strategy

1. Local development.
2. Test fixtures.
3. Staging.
4. Internal demo tenant.
5. One pilot school.
6. Multi-school pilot.
7. District aggregate layer.
8. National aggregate layer.

## Environment Gating

Production enablement requires:

- passing validation gate
- monitoring dashboards
- incident runbook
- rollback procedure
- kill switch
- tenant allowlist
- approval workflow

## Approval Thresholds

- Observe-only: engineering approval.
- Recommend-only: domain owner approval.
- Medium-risk action requests: school/admin governance approval.
- High-risk actions: platform admin or MOE-approved governance approval.
- Low-risk autonomous execution: production pilot evidence and explicit sign-off.

## Rollback Procedures

Roll back in this order:

1. Disable feature flag or kill switch.
2. Pause queue consumers.
3. Stop new workflow creation.
4. Resolve or cancel in-flight workflows.
5. Apply code rollback if needed.
6. Run replay/audit review.
7. Re-enable only after root cause is fixed and validated.

## Staged Autonomy Activation

Stages:

- Stage 0: documentation only.
- Stage 1: event observation.
- Stage 2: recommend-only.
- Stage 3: approval-gated execution.
- Stage 4: low-risk limited autonomy.
- Stage 5: scaled autonomy with governance review.
