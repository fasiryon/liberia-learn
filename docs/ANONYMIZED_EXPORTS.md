# Anonymized Exports

## Export Types
- Governed platform exports:
  - `student_performance`
  - `class_summary`
  - `monthly_report`
  - `intervention_effectiveness`
  - `ai_usage`
- MOE exports:
  - national aggregate CSV
  - district aggregate CSV
  - school cohort CSV
  - printable national summary

## Authorization
- Governed export job routes are platform-admin-only.
- Approval and download remain separated.
- Unapproved or incomplete governed exports cannot be downloaded.
- MOE exports require MOE official or platform admin access.

## Anonymization Strategy
- Direct PII is stripped with `stripPiiFromRecord()` and `anonymizeRows()`.
- Names are replaced with deterministic anonymized labels.
- Emails are anonymized.
- Phones are redacted.
- Dates may be generalized.
- MOE school cohort exports hash student identity with `schoolId` salt via `anonymizeStudentId()`.

## Data Shape Guarantees
- National and district MOE exports contain school-level metrics only.
- School cohort exports contain anonymized student rows and no raw names, emails, phones, or source IDs.
- Governed export downloads are audited and access logged.
