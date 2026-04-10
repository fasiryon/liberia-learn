# CURRENT EXECUTION STATE

## Purpose
This file records live progress only. It must match the actual repository and database state at the end of every session.

## Current workstream
DB reconciliation and migration ordering pass

## Current sprint or phase
Migration authority restoration in progress

## Current branch
main

## Worktree status
Dirty

## Worktree details
- Untracked migration directories are present:
  - `prisma/migrations/20260405_191827_phase1_system_of_record/`
  - `prisma/migrations/20260409_124356_phase2_school_operations/`
  - `prisma/migrations/20260410_000000_phase2_subject_reconciliation/`
  - `prisma/migrations/20260409_214655_phase3_exam_authority/`
- This session updated:
  - `docs/roadmaps/CURRENT_EXECUTION_STATE.md`

## Overall status
Phase 1 and Phase 2 authoritative migration reconciliation prepared locally; DB apply not run yet

## Last completed phase
Phase 3 exam authority code validation completed previously

## Last successful validation
- `npx tsc --noEmit`: PASS
- `npx vitest run`: PASS (`222` test files, `1609` tests)
- `npm run build`: PASS

## Validation run in this session
- `npx prisma migrate status --schema prisma/schema.prisma`: completed
- `npx prisma db pull --print --schema prisma/schema.prisma`: completed
- No code validation gate rerun in this session because the blocker is database state divergence, not application code.

## Blockers or discrepancies
- Live database does not contain the Phase 1 academic-record tables required by the current Prisma schema:
  - `AcademicYear`
  - `Term`
  - `AcademicEnrollment`
  - `Transcript`
- Database migration history reports `20260405_191827_phase1_system_of_record` as applied, but those Phase 1 tables are absent from the live database.
- Live database contains Phase 2 operational tables, but their structure does not match the validated Prisma schema:
  - `TeacherAssignment` has `subjectId` and `subjectName`, while the current schema expects a single `subject` enum field.
  - `Timetable` has `subjectId` and `subjectName`, while the current schema expects a single `subject` enum field.
- Live database contains the older exam system, but the Phase 3 exam extensions are absent:
  - `Exam.academicYearId`
  - `Exam.classId`
  - `Exam.publishedAt`
  - `Exam.resultsPublishedAt`
  - `ExamAttempt.tabSwitchCount`
  - `ExamAttempt.durationSeconds`
  - `ExamAttempt.integrityMetadata`
  - `ExamAttempt.submissionLog`
- Local authoritative recovery assets are now prepared:
  - restored `20260405_191827_phase1_system_of_record`
  - added `20260410_000000_phase2_subject_reconciliation`
- Database application has not started yet.

## Exact next step
Apply the restored Phase 1 migration and the new Phase 2 subject reconciliation migration to the live database in order, verify success, and then apply the Phase 3 exam extension migration.

## Files changed this session
- `docs/roadmaps/CURRENT_EXECUTION_STATE.md`
- `prisma/migrations/20260405_191827_phase1_system_of_record/migration.sql`
- `prisma/migrations/20260410_000000_phase2_subject_reconciliation/migration.sql`
