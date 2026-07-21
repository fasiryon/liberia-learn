# Doc B Additions - Phase B Enterprise Readiness

Date: July 21, 2026

These items were found during Phase B procurement and compliance inventory. They are logged separately from the June Doc B file to preserve the current session evidence without rewriting earlier audit history.

## B24 - Retention policy is not enforced by scheduled purge or anonymization

- **Severity:** HIGH
- **Perspectives:** Privacy, Procurement, SRE/DevOps
- **Source:** Combined Roadmap Phase B investigation, July 21, 2026
- **Description:** The public privacy policy states an active-account-lifetime-plus-2-years retention target, but there is no scheduled job that purges or anonymizes eligible student/account records according to that policy window. Current handling is manual and policy-bound.
- **Acceptance criteria:** Implement a scheduled retention workflow that identifies eligible records by data class, purges or anonymizes them according to policy, preserves required audit/safeguarding/school-record exceptions, and writes audit evidence for every action.
- **Estimated fix time:** Not scoped; requires careful schema/data-class design and production-safe dry-run reporting before destructive execution.

## B25 - Safeguarding alerting is reactive/queryable, not proactive

- **Severity:** HIGHER PRIORITY / SAFETY-CRITICAL
- **Perspectives:** Student Safety, Guardian, SRE/DevOps, School Admin
- **Source:** Combined Roadmap Phase B investigation, July 21, 2026
- **Description:** Safeguarding records and status are queryable, but proactive alerting to responsible reviewers is not implemented as a verified notification workflow. The platform should not claim proactive safeguarding notification until notifications are sent, delivered, logged, and visible for operations review.
- **Acceptance criteria:** Build proactive safeguarding alerting with responsible-recipient routing, delivery evidence, retry/failure handling, audit logging, and an operations view showing open, acknowledged, escalated, and failed-alert states.
- **Estimated fix time:** Not scoped; prioritize before broad real-family rollout.

## B26 - Governed export job generation is incomplete for some listed types

- **Severity:** MEDIUM
- **Perspectives:** Procurement, MOE Official, Platform Admin
- **Source:** Combined Roadmap Phase B investigation, July 21, 2026
- **Description:** Export job approval and download bookkeeping exists, but generation logic appears incomplete for some listed job types, including `intervention_effectiveness` and `ai_usage`. Direct aggregate exports exist for student performance, class summary, and monthly report, but job-backed generation should be audited type by type.
- **Acceptance criteria:** Inventory every `ExportJobRequest.exportType`, identify which types have real generation and storage paths, implement missing generation paths or remove unavailable types from request options, and add round-trip tests for each supported type.
- **Estimated fix time:** Not scoped; likely one focused governance export sprint.

