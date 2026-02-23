# AI Systems

## Principles
AI assists teachers and students. Teachers remain in control.

## Transparency Requirements
All AI suggestions must provide:
- brief explanation ("why")
- confidence/quality indicator (even if coarse: low/med/high)
- override + edit path
- audit + telemetry

## Telemetry Requirements
Track:
- suggestion acceptance rate
- override rate
- time-to-accept/override
- failure modes and timeouts

## Safety Requirements
- No autonomous permission changes
- No autonomous data deletion
- Sensitive operations require explicit human intent

## Versioning
AI prompts, templates, and output schemas must be versioned.
See `docs/governance/VERSION_GOVERNANCE.md`.