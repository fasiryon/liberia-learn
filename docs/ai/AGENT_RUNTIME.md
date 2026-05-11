# Agent Runtime

## Agent Registry

Each agent must be registered with:

- stable id
- owner domain
- feature flag
- allowed event triggers
- allowed tenant scopes
- required evidence
- allowed actions
- forbidden actions
- risk ceiling
- confidence contract
- escalation route
- evaluation metric

## Agent Lifecycle

1. Registered.
2. Enabled for environment.
3. Enabled for tenant.
4. Receives eligible event.
5. Loads evidence.
6. Produces recommendation or action request.
7. Routes approval if required.
8. Records outcome.
9. Feeds evaluation and memory.

## Agent Boundaries

Agents do not own core data models. They read existing state, emit events, create workflow records, and propose or execute governed actions through existing domain services.

## Confidence Scoring

Confidence must be calibrated against historical outcomes. Initial confidence is advisory only and cannot bypass approval gates.

## Evidence Requirements

Agent outputs must cite source records:

- event ids
- assessment attempt ids
- mastery snapshot ids
- intervention ids
- curriculum content/version ids
- AI interaction ids
- audit ids

## Memory Retrieval

Memory retrieval must filter by tenant, role, purpose, retention policy, and data sensitivity. Retrieved memory must be cited in the agent output.

## Escalation Rules

Escalate when:

- confidence is below threshold
- evidence conflicts
- target action is medium/high risk
- tenant boundary is ambiguous
- queue saturation or dependency instability is detected
- generated output fails deterministic validation

## Approval Routing

Approval routes must match the action:

- classroom instruction: teacher or school admin
- school operations: school admin or platform admin
- exports/governance: platform admin or MOE-authorized approver
- national policy recommendations: MOE official plus platform admin review

## Fallback Logic

If AI is unavailable, agents must degrade to deterministic recommendations or no-op. Do not fabricate outputs or metrics.

## Allowed Actions

- Generate explainable recommendations.
- Draft messages, interventions, lesson improvements, or reports.
- Queue low-risk follow-up reminders after governance approval.
- Update workflow, evaluation, and memory records.

## Forbidden Actions

- Change grades, promotion, discipline, eligibility, or official records without approval.
- Export raw PII to national layers.
- Send live SMS/email without configured provider, throttle, audit, and approval policy.
- Execute direct database writes outside approved domain services.
- Call AI providers directly.
