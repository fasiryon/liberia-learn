# Context routing

Load only the route that matches the task. These documents are not a default
reading list.

| Task | Load |
| --- | --- |
| Sprint or national rollout planning | The relevant current-status section in `docs/roadmaps/CURRENT_EXECUTION_STATE.md`, then the relevant section of `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md` |
| Backlog selection | `docs/roadmaps/CONSOLIDATED_BACKLOG.md` |
| Schema or migration work | The migration runbook under `docs/ops/` that applies to the change, plus `docs/agents/ADVISOR_ESCALATION_CONTRACT.md` |
| Security, RBAC, tenant, audit, privacy, or child safety | The specific applicable document under `docs/security/` or `docs/agents/` |
| Curriculum, grading, or educational authority | The relevant curriculum or governance document under `docs/` and, when generating artifacts, the applicable prompt under `docs/internal/agents/` |
| Deployment, infrastructure, or live operations | The specific deployment or `docs/ops/` runbook; authorization is still required for mutation |
| AI prompt or provider routing | The relevant prompt/provider contract under `lib/ai/` or `docs/` |

Read linked supporting documents only when the selected route requires them.
Do not load historical plans (`docs/roadmaps/MASTER_EXECUTION_PLAN.md`,
`rules.md`, or `SPEC.md`) unless investigating historical provenance.
