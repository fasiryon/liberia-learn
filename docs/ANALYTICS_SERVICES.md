# Analytics Services

## Current Services
- `studentLongitudinal.ts`
- `interventionEffectiveness.ts`
- `teacherActionCorrelation.ts`
- `aiUsageQuality.ts`
- `misconceptionFrequency.ts`
- `retentionSummary.ts`
- `schoolClassSummary.ts`

## Inputs
- `DerivedStudentProgress`
- `InterventionChain`
- `TeacherAction`
- `AIInteraction`
- `MisconceptionTag`
- tenant school and class records

## Output Types
- student longitudinal summaries
- aggregate mastery and growth
- intervention closure and attribution
- teacher action mix and activity volume
- AI usage, token, cost, and fallback summaries
- misconception frequency and origin
- retention and by-school activity
- school and class census summaries

## Service Contracts
- Services are internal, typed, and read-only.
- Tenant-aware services must accept `schoolId` and apply it in data reads.
- Aggregate APIs may be MOE-safe when they omit per-student rows.
- Services must not return cross-tenant data in school-scoped use.

## Known Phase 1 Boundaries
- `getAiUsageQuality()` supports school scoping for tenant isolation.
- `getRetentionSummary()` must scope active-row reads by school.
- `getLongitudinalAggregate()` is aggregate-safe, but per-student summaries remain internal only.
