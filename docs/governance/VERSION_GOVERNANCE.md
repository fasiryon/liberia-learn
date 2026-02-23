# Version Governance (V1)

## What This Is
Version governance defines how LiberiaLearn changes over time without breaking schools.
It is how national systems remain stable for years while evolving.

## Version Types
We use semantic versioning: MAJOR.MINOR.PATCH

- PATCH: bug fixes, performance improvements, non-breaking changes
- MINOR: new features that are backward compatible (often behind flags)
- MAJOR: breaking changes (API contracts, data model, permissions, offline protocol)

## “Breaking Change” Definition
A change is breaking if it affects:
- API response shapes used by clients
- authentication/session behavior
- tenant isolation model
- permission matrix
- offline sync protocol or conflict behavior
- database schema requiring destructive migration
- data export formats expected by MOE/schools

## Release Branch Discipline
Recommended:
- `main`: always releasable
- `release/x.y`: optional stabilization branch for a minor release
- hotfix branches for urgent patches

## Compatibility Policy
- Maintain backward compatibility across MINOR releases.
- Deprecate features for at least 1 MINOR release before removal (when possible).
- Use feature flags to stage rollout and reduce risk.

## Data Schema Versioning
- Prisma migrations must be reviewed carefully.
- Migrations that are destructive require:
  - explicit plan
  - backup/rollback strategy
  - staged rollout

## Offline Protocol Versioning
Offline sync is treated like a protocol:
- Any change to sync payload shape or conflict rules must be versioned.
- Clients must be able to handle at least the previous protocol for one MINOR window (where feasible).

## AI Versioning
AI artifacts must include:
- prompt/template version
- output schema version
- model provider/version (when relevant)
This prevents “silent behavior drift.”

## Deprecation Workflow
When deprecating:
1) mark as deprecated in docs
2) flag warnings in logs/telemetry
3) provide migration path
4) remove only on a MAJOR (or planned MINOR with adequate transition)

## Rollback Governance
- Prefer feature-flag rollback first
- If rollback requires code, issue PATCH release
- SEV1 issues can trigger immediate hotfix

## Release Checklist
Every release must include:
- change summary
- migration notes (if any)
- flag changes
- telemetry changes
- rollback plan

This is non-negotiable for national infrastructure.