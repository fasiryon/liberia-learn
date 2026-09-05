# LiberiaLearn On-Call Contract

## Current readiness

The repository defines the roles and response contract, but no live named
roster or external paging channel is certified. Until those are activated,
on-call readiness is `NOT_CONFIGURED` for automated notification delivery and
`PENDING` for the human roster.

## Required roles

| Role | Responsibility |
|---|---|
| Incident commander | Owns severity, coordination, updates, and closure. |
| Platform operator | Owns runtime, database, deployment, queues, and rollback investigation. |
| Safeguarding owner | Owns child-safety and critical moderation response. |
| AI quality owner | Owns P7 quality evidence, release blocks, and rollback recommendations. |
| Review operations owner | Owns curriculum and quality review backlog and reviewer coordination. |
| MOE liaison | Owns ministry decisions and externally governed activation. |

Named people, phone numbers, and private escalation details belong in the
approved external roster, not in the repository.

## Severity and escalation

Use `docs/ops/INCIDENT_RESPONSE.md` for P0 through P3 response times. NR-15
maps `CRITICAL` alerts to immediate incident assessment, `WARNING` to prompt
operator triage, and `INFO` to routine review. A hard safety, security, tenant
isolation, or P7-C release block cannot be suppressed into a healthy status.

## Activation checklist

- Assign a named primary and backup for every required role.
- Configure and verify an external delivery provider.
- Perform a real delivery, acknowledgement, and recovery drill.
- Record response timestamps and evidence without storing private contact data.
- Review the roster after personnel changes and at least quarterly.


