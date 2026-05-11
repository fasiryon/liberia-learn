# Autonomous OS Execution Plan

## Phased Execution Plan

This plan bootstraps the Autonomous Education Operating System without implementing uncontrolled automation.

### Phase 0: Architecture And Governance Foundation

Status: documentation and contracts only.

- Create persistent AI engineering guidance.
- Inventory existing reusable systems.
- Define event, workflow, agent, action, evaluation, memory, optimization, observability, rollout, and safety contracts.
- No runtime autonomy is enabled.

Gate:

- Documentation reviewed.
- No duplicate architecture introduced.
- TypeScript, tests, and build still pass.

### Phase 1: Event And Workflow Schema Foundation

- Extend `LearningEvent` only if gaps remain after inspection.
- Add workflow record schema with tenant scope, status, checkpoints, retry counts, idempotency keys, evidence references, and audit refs.
- Add indexes for tenant/time/status/replay queries.
- Add typed workflow creation and checkpoint services.

Dependencies:

- Existing `LearningEvent`, `AIInteraction`, `AuditLog`, queue helpers, RBAC.

Gate:

- Additive Prisma migration.
- Event replay/idempotency tests.
- Full validation gate.

### Phase 2: Detection And Recommend-Only Agents

- Add agent registry.
- Add deterministic detectors for at-risk learning signals, intervention follow-up, curriculum quality issues, and operational anomalies.
- AI-assisted classification allowed only through `routedCompletion()`.
- Agents produce recommendations, not direct writes.

Gate:

- Feature flags default off.
- Tenant-isolation tests.
- Recommendation audit tests.

### Phase 3: Approval-Gated Action Layer

- Add action request records or extend existing approval models where suitable.
- Implement approval matrix and UI/API for reviewing medium/high-risk actions.
- Wire low-risk read-only notifications and medium-risk drafts.

Gate:

- Approval required tests.
- Rollback and audit tests.
- Kill switch tests.

### Phase 4: Evaluation And Memory

- Add outcome attribution for recommendations and interventions.
- Add false-positive/false-negative tracking.
- Add operational memory summaries with tenant-safe lineage.
- Add retrieval only after retention, redaction, and tenant partitioning are in place.

Gate:

- No raw PII in memory tests.
- Attribution tests.
- Memory lineage tests.

### Phase 5: Optimization And National Intelligence

- Add forecasting, trend analysis, curriculum optimization proposals, and aggregate national intelligence.
- Keep national layer aggregate-only with cohort suppression.
- Generate recommendations with evidence and explainability.

Gate:

- MOE privacy tests.
- Aggregate suppression tests.
- Evaluation quality tests.

### Phase 6: Controlled Autonomy Expansion

- Enable limited low-risk autonomous actions with strict rate limits.
- Keep medium/high-risk approval-gated.
- Add execution graphs, replay console, incident controls, and cost dashboards.

Gate:

- Production pilot evidence.
- Governance sign-off.
- Load and queue saturation tests.

## Subsystem Build Order

1. Event stream extension.
2. Durable workflow records.
3. Agent registry.
4. Detection services.
5. Recommendation output.
6. Approval-gated actions.
7. Evaluation metrics.
8. Memory summaries.
9. Optimization proposals.
10. Controlled autonomy.

## Operational Gates

Do not advance phases unless:

- feature flags and kill switches exist
- audit and learning events are emitted
- tenant scoping is tested
- AI telemetry is redacted
- queue retry and dead-letter paths are tested
- build and tests pass
