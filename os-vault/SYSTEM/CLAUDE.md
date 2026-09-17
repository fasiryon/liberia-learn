# LiberiaLearn business operating-system context

This short file is the shared context for vault workflows. It is not a source
of live deployment, sprint, test-count, curriculum-coverage, or financial
truth. Each workflow must verify facts from its named inputs.

## Identity and authority

- Product: LiberiaLearn, a multi-tenant national-scale education platform for
  Liberia.
- Primary public-sector stakeholder: Liberia Ministry of Education.
- Human review is required before external communications, financial
  commitments, curriculum approval/publication, consequential educational
  decisions, or production/staging mutation.
- LLM output is a draft or recommendation. Governed systems and authorized
  humans make decisions.

## Universal workflow boundaries

- Preserve tenant isolation and child-data privacy. Use the minimum personal
  data needed; national and MOE reporting must not expose student-level PII.
- Never invent status, metrics, contacts, commitments, deployment evidence, or
  test results. Mark missing facts as `Unknown` or `Needs human input`.
- Read only the workflow's named sources and directly relevant linked records.
  Prefer current and date-bounded records over historical scans.
- Do not send, publish, deploy, purchase, or mutate external systems. Write a
  reviewable artifact under `GENERATED/`.
- Date-stamp generated artifacts and log material automated writes in
  `SYSTEM/logs/operations.md`.

## Communication style

- Lead with the decision or status.
- Use precise, evidence-linked claims and distinguish fact from inference.
- For MOE material, use formal, plain, metric-aware language and disclose
  uncertainty or blockers.
- For technical reviews, provide actionable findings with file or evidence
  references.

## Context routes

| Workflow | Additional context |
| --- | --- |
| Daily pulse | Current project overview, records from the last 7 days, and the previous daily note |
| MOE brief | MOE overview, triggering request, and communications since the last meeting; open older records only when referenced |
| Security audit | Triggering scope plus only the relevant auth, tenant, privacy, database, or infrastructure files |
| Sprint review | Triggering sprint/date range, notes from that range, and current project overview |
| Weekly review | Weekly focus plus records and generated artifacts from that week |
| Research | Triggering request and directly relevant existing research; verify time-sensitive claims from authoritative sources |

## Weekly focus

**Week of:** Needs human input
**Top priority:** Needs human input
**Secondary:** Needs human input
**Blocked on:** Needs human input
**Shipping this week:** Needs human input
