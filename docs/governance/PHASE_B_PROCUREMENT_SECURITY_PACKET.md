# LiberiaLearn Procurement and Security Packet

Prepared: July 21, 2026

## Executive summary

LiberiaLearn has real production controls for role-based access, school tenant isolation, audit logging, governed aggregate exports, health checks, and public legal/privacy pages. This packet is current-state accurate. It lists implemented controls and known gaps separately so Ministry or procurement reviewers are not given aspirational claims as if they were live guarantees.

## Architecture

LiberiaLearn is a Next.js application deployed on Vercel with Supabase/Postgres as the primary database. Prisma is used for database access. The application uses server-side route handlers for protected operations and public route handlers for health and legal surfaces.

Current `/api/health` checks database access, migration state, AI configuration, and SMS runtime mode. SMS currently reports `sms: "ok"` with `smsMode: "dry_run"` in production. If live SMS is enabled and credentials are present, health reports `live_configured_unverified`, not verified live delivery.

## Access control

Role-based access is enforced through authenticated server routes and permission checks. School admins and teachers are scoped to their school context. Guardians are scoped to linked learners. Students are scoped to their own records. MOE dashboard views are read-only and aggregate by default.

Authorized MOE exports may include pseudonymized school-cohort learner rows for oversight review. These exports do not include student names, emails, phone numbers, guardian contact details, or raw student identifiers. This distinction is deliberate: dashboards are aggregate, while authorized exports can support cohort review without direct PII.

## Audit and export controls

Audit logs, export records, and data-access logs exist for governance review. Audit logs are append-only in application code and protected by database immutability triggers. Compliance audit search and CSV export are implemented with role and permission checks.

Implemented governance exports include:

- student performance aggregates
- class summary aggregates
- monthly report aggregates
- audit log search and CSV export
- delivery compliance reporting when enabled

Governed export job approval and download bookkeeping exists. Some export job types still lack real generation logic and are logged for a future sprint.

## Data handling

Student and account data is used for education delivery, progress tracking, teacher support, guardian access, school administration, and Ministry oversight. AI prompts and telemetry are designed to avoid direct student PII. Public policy pages prohibit advertising sale or commercial profiling of student data.

MOE dashboards should be described as aggregate. MOE school cohort exports should be described as pseudonymized individual-row exports without direct identifiers.

## Safeguarding

Safeguarding records and review surfaces exist, and escalation status can be queried. Current safeguarding alerting is reactive and queryable rather than proactive. LiberiaLearn should not claim proactive safety notification until a real alert workflow sends timely notifications to responsible reviewers and records delivery evidence.

This gap is safety-critical and should be prioritized above ordinary compliance polish.

## Backup and recovery

Current backups are nightly CSV stopgap exports to private Vercel Blob storage with 90-day pruning. This is not a full database backup or a verified point-in-time restore posture.

The procurement path should include the planned Supabase upgrade for managed backups and point-in-time recovery, followed by documented restore drills with real timings, row counts, and a sample-record verification procedure.

## Retention

The privacy policy states an active-account-lifetime-plus-2-years target. Automated enforcement for that window is not implemented today. Current deletion and retention handling is manual and policy-bound. A scheduled purge or anonymization job with audit evidence is required before claiming automated retention enforcement.

## SSO

Single sign-on is available on request and should be scoped once a specific institutional identity provider is named. Building SSO without a buyer-specified provider risks implementing the wrong protocol, claims mapping, and operational ownership model.

## Known gaps and planned work

| Gap | Current state | Planned work |
|-----|---------------|--------------|
| Retention enforcement | Policy target exists; no scheduled purge/anonymization job enforces it | Build scheduled retention workflow with audit evidence |
| Full backup and restore | CSV stopgap backups exist; no full DB point-in-time restore posture on Supabase free tier | Upgrade Supabase, enable managed backups/PITR, run restore drills |
| Safeguarding alerting | Reactive/queryable status exists | Build proactive notifications and delivery evidence |
| Export job generation | Some job approval/download surfaces exist without generation for all listed types | Audit each type and implement missing generation paths |

