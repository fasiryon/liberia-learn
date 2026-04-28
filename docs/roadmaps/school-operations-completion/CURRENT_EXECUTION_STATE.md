# Current Execution State

## Branch
feat/school-operations-completion

## Current Phase
Phase 3 — Real Timetable / Bell Schedule

## Status
COMPLETE

## Last Completed Phase
Phase 3 — Real Timetable / Bell Schedule

## Phase 1 Implementation Summary

### Inspection Findings
- AcademicYear model: **ALREADY EXISTS** (yearLabel, startDate, endDate, isActive, terms[])
- StudentEnrollment (AcademicEnrollment): **ALREADY EXISTS** — extended with promotedAt + updatedAt
- AcademicEnrollmentStatus enum: **EXTENDED** — added COMPLETED and RETAINED
- student.gradeLevel: **EXISTS AS student.currentGrade** — all reads preserved, updated on promotion
- Existing academic-year routes: GET/POST/PATCH /api/admin/academic-year — already present
- Existing enrollment route: GET/POST/PATCH /api/admin/enrollment — already present
- Existing admin UI: /admin/academic-year page (create/list/activate) — already present

### Schema Changes (migration: 20260427_000000_academic_year_promotion)
- AcademicEnrollmentStatus: added COMPLETED, RETAINED
- AcademicEnrollment: added promotedAt DateTime?, updatedAt DateTime @updatedAt

### New Services
- lib/academics/academicYear.ts — getActiveAcademicYear, createAcademicYear, setActiveAcademicYear
- lib/academics/promotion.ts — previewPromotions, promoteStudents, retainStudents, graduateStudents
- lib/records/promotion.ts — updated canTransitionEnrollmentStatus for new statuses

### New API Routes
- GET  /api/admin/promotions/preview
- POST /api/admin/promotions/promote
- POST /api/admin/promotions/retain
- POST /api/admin/promotions/graduate

### Admin UI
- app/admin/academic-year/page.tsx — Promotion section added (source/target year selectors,
  preview table with checkboxes, Promote/Retain/Graduate actions, result summary)

### Backward Compatibility
- student.currentGrade updated on promote — all existing reads continue to work
- AcademicEnrollment unique constraint (studentId, schoolId, academicYearId) respected:
  promote and retain use source + target year IDs, so no constraint violations

## Gate Results
| Gate                | Status                              |
| ------------------- | ----------------------------------- |
| npx prisma generate | PASS                                |
| npx tsc --noEmit    | PASS (0 errors)                     |
| npx vitest run      | PASS — 2190 tests, 299 files        |
| npm run build       | PASS                                |

## New Tests
- __tests__/academics/academicYear.test.ts — 4 tests
- __tests__/academics/promotion.test.ts — 12 tests
- __tests__/academics/promotionRoutes.test.ts — 7 tests
- Total new: 23 tests

## Phase 2 Implementation Summary

### Inspection Findings
- Existing import system: createStudentImportBatch (lib/school-operations.ts) + StudentImportBatch table — PRESERVED
- Existing import page: /admin/students/import — REWRITTEN as 4-step wizard
- No existing teacher/guardian batch import — new direct creation logic added
- Subject enum: MATH, SCIENCE, COMPUTER_SCIENCE, ENGINEERING, LITERACY, CIVICS, ARTS, PE, CAREER (no ENGLISH/SOCIAL_STUDIES)

### New Files
- lib/imports/schoolImportValidator.ts — validateStudentRows, validateTeacherRows, validateGuardianRows, buildErrorCsv
- app/api/admin/import/validate/route.ts — POST, no DB writes, returns ValidationResult
- app/api/admin/import/preview/route.ts — POST, no DB writes, returns preview/errors/summary
- app/api/admin/import/confirm/route.ts — POST, re-validates then writes; returns imported/skipped/failedRowsCsv
- app/api/admin/import/template/[importType]/route.ts — GET, returns CSV templates
- public/sample-student-import.csv, sample-teacher-import.csv, sample-guardian-import.csv

### Updated Files
- app/admin/students/import/page.tsx — full 4-step wizard (upload → validate → confirm → results)

### TypeScript Fixes Applied
- z.record(z.string()) → z.record(z.string(), z.string()) (Zod 4 requires both key+value args)
- gradesTaught: GradeBand[] via gradeToGradeBand() helper
- subjectsTaught: Subject[] via cast

## Gate Results (Phase 2)
| Gate                | Status                              |
| ------------------- | ----------------------------------- |
| npx tsc --noEmit    | PASS (0 errors)                     |
| npx vitest run      | PASS — 2215 tests, 300 files        |
| npm run build       | PASS                                |

## New Tests (Phase 2)
- __tests__/imports/schoolImportValidator.test.ts — 25 tests
  - Students: valid pass, missing column, grade OOB, bad date format, within-CSV dup, DB dup, tenant scope
  - Teachers: valid pass, invalid subject, within-CSV dup email, DB dup at same school, different-school passes
  - Guardians: student found (no warning), student not found (warning), DB dup email
  - buildErrorCsv: error_reason column appended
  - API: POST /validate no DB write, POST /confirm writes valid only, skips invalid, GET /template, 403 checks

## Phase 3 Implementation Summary

### Inspection Findings
- Timetable model: **ALREADY EXISTS** — flat per-period model (one record = one period slot per class/day/teacher/subject)
- Existing infrastructure: `/api/admin/timetable` CRUD routes, `app/admin/timetable/page.tsx`, `lib/records/schoolOperations.ts` service
- Existing teacher schedule route: `app/api/teacher/schedule/route.ts` — for ScheduledWork (NOT timetable)
- Missing: TimetableAssignment model (lesson on specific date), teacher/student timetable view routes, timetable field in today response
- Design decision: existing `Timetable` model acts as the slot — added `TimetableAssignment` model only

### Schema Changes (migration: 20260427_000001_timetable)
- New model: `TimetableAssignment` — links Timetable slot to CurriculumContent for a specific date
  - Unique: `[timetableId, assignedDate]` — one assignment per slot per day (UPSERT semantics)
  - FK: Timetable (cascade), CurriculumContent (set null), User/assignedBy (cascade)
  - `assignedDate @db.Date` — calendar date only
- Timetable model: added `assignments TimetableAssignment[]` back-relation
- User model: added `timetableAssignments TimetableAssignment[]` back-relation
- CurriculumContent model: added `timetableAssignments TimetableAssignment[]` back-relation

### New Files
- `lib/timetable/timetableService.ts` — getTimetableForStudent, getTimetableForTeacher, assignLessonToSlot, removeLessonFromSlot
- `app/api/teacher/timetable/today/route.ts` — GET teacher's periods for today
- `app/api/teacher/timetable/[timetableId]/assign/route.ts` — POST/DELETE lesson assignment
- `app/api/student/timetable/today/route.ts` — GET student's timetable for today
- `app/teacher/timetable/page.tsx` — teacher timetable view with assign-lesson panel

### Modified Files
- `app/api/student/today/route.ts` — added `timetable` field (null-safe, sequential after existing Promise.all)
- `app/student/today/page.tsx` — added TimetableSection component + timetable state (above full day plan, hidden when null)
- `prisma/schema.prisma` — TimetableAssignment model + back-relations

### Backward Compatibility Confirmed
- ScheduledWork still works: YES — unchanged, still drives `items[]` in today response
- Adaptive plan still shows: YES — `adaptivePlan` field unchanged
- Existing today fields unchanged: YES — `timetable` field appended, no existing field removed
- Admin timetable CRUD: UNCHANGED — existing routes/service/page all still work

## Gate Results (Phase 3)
| Gate                | Status                              |
| ------------------- | ----------------------------------- |
| npx prisma generate | PASS                                |
| npx tsc --noEmit    | PASS (0 errors)                     |
| npx vitest run      | PASS — 2244 tests, 303 files        |
| npm run build       | PASS                                |

## New Tests (Phase 3)
- `__tests__/timetable/timetableService.test.ts` — 16 tests
  - getTimetableForStudent: null for no enrollments, null for no slots, sorted by time, correct weekday, tenant scoping
  - getTimetableForTeacher: empty array, sorted, schoolId scoping
  - assignLessonToSlot: success, 404 on non-owner, upsert semantics
  - removeLessonFromSlot: success, 404 on non-owner
- `__tests__/timetable/timetableAssignment.test.ts` — 6 tests
  - POST assign: success, 404, 403, logAudit
  - DELETE assign: success, 400 missing date
- `__tests__/timetable/todayEndpoint.test.ts` — 7 tests
  - timetable null when not configured, period count correct, assignment details, null assignment, backward compat, student not found, service error resilience

## Risks Active
- student.currentGrade backward compatibility: PRESERVED
- AcademicEnrollment unique constraint: RESPECTED
- TimetableAssignment migration: additive only (new table)
- lessonUrl in timetable uses `/student/lessons/<contentId>` — lesson page must handle contentId param

## Next Phase
Phase 4 — Attendance / Analytics

## Notes
Do not push unless explicitly instructed.
Run phases sequentially.
