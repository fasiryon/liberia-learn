# Data Intelligence Architecture

## Scope
Phase 1 data intelligence spans Sprint 2 through Sprint 7:

- Sprint 2: immutable learning events and normalized provenance
- Sprint 3: append-only mastery snapshots, derived progress, intervention chains, misconceptions
- Sprint 4: AI telemetry privacy, version references, offline replay identity
- Sprint 6: MOE aggregate dashboards and student learning passport
- Sprint 7: governance, anonymized exports, analytics services, data access logging

## Core Layers
- Raw evidence:
  - `LearningEvent`
  - `AssessmentAttempt`
  - `TeacherAction`
  - `AIInteraction`
  - intervention records
- Append-only derived state:
  - `MasterySnapshot`
  - `DerivedStudentProgress`
  - `MisconceptionTag`
- Computed views:
  - MOE dashboard aggregates
  - student passport
  - internal analytics services
- Governance and access:
  - `ExportJobRequest`
  - `DataAccessLog`
  - `AuditLog`

## Invariants
- Raw records are never rewritten into derived state tables in place.
- `MasterySnapshot` and `DerivedStudentProgress` are append-only service writes.
- `InterventionChain` preserves lifecycle linkage across baseline, intervention, outcome, and retention.
- AI telemetry stores metadata, versions, hashes, cost, and counts, not raw prompt text.
- Offline replay safety uses `clientEventId`, `dedupeKey`, `originalOccurredAt`, and `syncReceivedAt`.
- MOE services return aggregate or anonymized views only.

## Main Services
- `lib/events/logLearningEvent.ts`
- `lib/intelligence/derivedProgress.ts`
- `lib/interventions/interventionChains.ts`
- `lib/ai/interactionLog.ts`
- `lib/passport/buildStudentPassport.ts`
- `lib/analytics/*.ts`
- `lib/exports/exportJobService.ts`
- `lib/exports/anonymize.ts`
- `lib/dataAccess/logDataAccess.ts`

## Access Boundaries
- Student passport: student self-access or linked guardian only.
- MOE dashboard: national aggregate-only access via MOE authority checks.
- Governed exports: platform-admin-only request, approval, and download flow.
- Analytics services accept tenant scope and must not mix school data.

## Hardening Notes
- School-scoped retention analytics must filter active rows by `schoolId`.
- AI usage analytics must support school scoping when used in tenant contexts.
- Duplicate offline sync payloads are rejected on second replay identity match.
- Data-intelligence read paths should emit `DataAccessLog` entries in addition to audit events.
