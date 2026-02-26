# District Intelligence

## Scope Definition
District Intelligence provides district-level aggregate dashboards. It aggregates school-level metrics within a district boundary. No student, teacher, or school ranking data is returned.

## Liberia Counties (15)
- Bomi
- Bong
- Gbarpolu
- Grand Bassa
- Grand Cape Mount
- Grand Gedeh
- Grand Kru
- Lofa
- Margibi
- Maryland
- Montserrado
- Nimba
- River Cess
- River Gee
- Sinoe

## Metric Definitions
District metrics extend the school dashboard aggregates and add district-specific rollups:
- `avgMasteryScore`: mean of school-level mastery averages
- `trainingAdoptionRate`: mean of school-level training completion rates
- `evidenceSubmissionRate`: mean of school-level evidence submission rates
- `schoolCount`: number of schools in the district
- `schoolsAtRisk`: count of schools with growthRiskFlag >= "medium"
- `topInterventionPriority`: highest intervention priority score among schools in the district

## Governance Guarantees
- No cross-district access. District admins are hard-scoped to their district.
- No public ranking. District views are aggregate-only.
- No PII. All payloads are aggregate metrics only.
- Feature-flagged. District intelligence defaults OFF.


