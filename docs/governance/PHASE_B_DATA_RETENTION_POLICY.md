# LiberiaLearn Data Retention Policy

Effective date: July 21, 2026

## Purpose

This policy describes LiberiaLearn's current retention practice and the enforcement work still planned. It is written for Ministry, procurement, and security review. It does not claim automation that is not implemented in code today.

## Current limitations at a glance

- Automated retention enforcement is not yet implemented.
- Deletion and retention review is currently manual and policy-bound.
- Current backups are stopgap CSV backups, not full database point-in-time recovery.
- Supabase managed backup and restore capability requires the planned paid-tier upgrade.

## Current practice

Student, guardian, teacher, school, assignment, progress, attendance, and operational records are retained while the school or account remains active. Retention after school offboarding or account closure is currently handled through operational review rather than an automated scheduled purge or anonymization job.

The public privacy policy states an active-account-lifetime-plus-2-years target. That target is not yet enforced by an automated scheduled job. The future implementation must create a policy-matched purge or anonymization workflow with audit evidence and exception handling.

## Audit and access records

Audit logs, export records, and data-access logs are retained for accountability and procurement review. Audit logs are append-only in application code and protected by database immutability triggers. These records are not deleted during ordinary account cleanup because they preserve evidence of administrative, safeguarding, export, and security-relevant actions.

## Backups

Current backups are nightly CSV stopgap exports to private Vercel Blob storage with 90-day pruning. They support targeted recovery evidence and operational inspection, but they are not a full database backup, a point-in-time recovery posture, or a verified restore drill.

LiberiaLearn remains on the Supabase free tier. The production procurement path should include the planned Supabase upgrade for managed backups, point-in-time recovery, and documented restore drills before national-scale rollout.

## Requests and deletion

Guardians and schools may request access, correction, or deletion review. Deletion is evaluated against school record obligations, safeguarding obligations, audit obligations, and Ministry requirements. Where deletion is permitted, the current process is manual and policy-bound.

## Planned enforcement work

The required future sprint is a real retention-enforcement workflow:

- scheduled review by data class
- purge or anonymization for eligible records
- audit evidence for every action
- exceptions for legal, school-record, safeguarding, or procurement holds
- operational report showing rows reviewed, rows changed, and rows held
