# Longitudinal Grading (Time-Series Mastery)

Status:
- Existing grading models support point-in-time grades.
- This design adds time-series mastery, evidence chain, interventions, and cohort benchmarks.

Core additions:
1) ObjectiveMasterySnapshot (append-only)
2) MasteryEvidence (links snapshot to grade records)
3) StudentIntervention + InterventionOutcome
4) CohortBenchmark (nightly aggregate)

Key query patterns:
- Student growth over time per objective
- Plateau/stagnation detection
- Evidence-type effectiveness
- Intervention ROI
- Cohort comparisons (class/school/county/national)
