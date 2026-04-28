# Current Execution State

## Branch
feat/school-operations-completion

## Current Phase
Phase 5 — Full-Year Curriculum Organization

## Status
COMPLETE

## Last Completed Phase
Phase 5 — Full-Year Curriculum Organization

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

## Phase 4 Implementation Summary

### Inspection Findings
- Student assignment list page: **MISSING** before this phase; only `/student/assignments/[id]` submission page existed.
- Student assignment list API: **MISSING** before this phase; only `/api/student/assignments/[id]/submit` existed.
- Teacher assignment page: one-time fetch only, no polling; creation flow navigated back to `/teacher/assignments?created=1`.
- Teacher student detail page: one-time fetch only, showed scheduled-work progress but no assignment submission feed.
- Teacher dashboard: one-time fetch only, no class overview polling indicator.
- Existing polling: present elsewhere for timers/admin curriculum/lesson autosave, but no assignment or submission polling.
- Existing learning events: `assignment.created` logged; missing `assignment_viewed`, `assignment_list_polled`, `submission_viewed_by_teacher`, `submission_feed_polled`.
- Mid-session student behavior before Phase 4: a newly created assignment did not appear until manual navigation/reload; no banner or timestamp.

### New Files
- `lib/hooks/useAssignmentPolling.ts` — client polling hook with default 30-second interval, immediate mount fetch, manual refresh, silent failure handling, cleanup.
- `lib/assignments/pollingPresentation.ts` — submission sorting, new-submission, score-label, and tenant-filter helpers.
- `app/api/student/assignments/route.ts` — student-scoped assignment list endpoint with count-change poll logging.
- `app/student/assignments/page.tsx` — student assignment list with 30-second polling, manual refresh, last-updated timestamp, new banner, badges, sorting, and empty state.
- `__tests__/polling/assignmentPolling.test.ts` — 6 hook tests.
- `__tests__/polling/submissionFeed.test.ts` — 4 submission feed helper tests.
- `__tests__/assignments/assignmentEvents.test.ts` — 4 learning-event tests.

### Modified Files
- `app/student/assignments/[id]/page.tsx` — logs `assignment_viewed`.
- `app/student/today/page.tsx` — adds 30-second polling/manual refresh/last-updated timestamp so timetable assignments refresh without reload.
- `app/api/teacher/students/[studentId]/route.ts` — adds teacher-scoped submissions, newest-first ordering, poll metadata, and submission learning events.
- `app/teacher/students/[studentId]/page.tsx` — adds submission feed polling, new-submission indicator, manual refresh, last-checked timestamp, and review action.
- `app/api/teacher/assignments/route.ts` — submission list now sorts by `turnedInAt desc`.
- `app/teacher/dashboard/page.tsx` — adds 60-second dashboard polling, last-updated timestamp, and new-submission count link.

### Polling Strategy
- Student assignments: 30-second polling plus manual refresh only.
- Student Today/timetable: 30-second polling plus manual refresh only.
- Teacher student submission feed: 30-second polling plus manual refresh only.
- Teacher dashboard overview: 60-second polling only, with subtle count indicator.
- No Supabase Realtime, WebSockets, Pusher, Ably, or new realtime vendor introduced.

### Event Logging
- `assignment_viewed` logs when a student opens an assignment detail page.
- `assignment_list_polled` logs only when assignment count changes during a poll.
- `submission_viewed_by_teacher` logs when a teacher opens student detail with submissions.
- `submission_feed_polled` logs only when submission count changes during a poll.
- Duplicate poll logging avoided when counts do not change in the same session.

### Timetable Integration
- Student Today now polls `/api/student/today`; timetable assignments added in Phase 3 are refreshed within 30 seconds or immediately on manual refresh.

### Mobile Considerations
- Polling controls use `min-h-11` touch targets.
- Assignment banner stacks full-width on narrow screens.
- Last-updated text truncates with `truncate`.
- Layouts use responsive flex/grid classes to avoid horizontal overflow.
- Mobile 375px behavior was implemented with responsive classes and validated by build, but not manually browser-verified in this session.

### Gate Results (Phase 4)
| Gate                | Status                              |
| ------------------- | ----------------------------------- |
| npx prisma generate | PASS                                |
| npx tsc --noEmit    | PASS (0 errors)                     |
| npx vitest run      | PASS — 2258 tests, 306 files        |
| npm run build       | PASS                                |

### New Tests (Phase 4)
- `__tests__/polling/assignmentPolling.test.ts` — 6 tests
- `__tests__/polling/submissionFeed.test.ts` — 4 tests
- `__tests__/assignments/assignmentEvents.test.ts` — 4 tests
- Total new: 14 tests

## Phase 5 Implementation Summary

### Critical Pre-Check
- Timetable lesson links used `/student/lessons/<contentId>`, but the student lesson loader only resolved `ScheduledWork.id`.
- Fixed `/api/student/work/[scheduledWorkId]` to resolve either scheduled work IDs or raw `CurriculumContent.contentId` from today's timetable assignment.
- When a timetable contentId is opened, the route finds or creates a same-day `ScheduledWork` so read/slides/listen modes use the existing delivery client and progress saves through the existing completion flow.
- Back navigation remains the existing `Back to today` link in lesson delivery.

### Schema Changes (migration: `20260428_000000_curriculum_year_mapping`)
- Added enums: `CurriculumLessonType` (`CORE`, `REVIEW`, `LAB`, `ASSESSMENT`, `PROJECT`) and `CurriculumMappedSource` (`EXISTING`, `GENERATED`).
- Extended existing `CurriculumUnit` instead of duplicating it: added `title`, `gradeLevel`, `academicYearId`, `orderIndex`; made `schoolId` and `createdById` optional for national/platform-wide mapping.
- Added `CurriculumWeek` with `unitId`, `weekNumber`, `theme`, `orderIndex`.
- Added `CurriculumLessonPlan` with `weekId`, `curriculumContentId`, `dayNumber`, `lessonType`, `mappedSource`, `orderIndex`.
- Added relations from `AcademicYear` and `CurriculumContent`.

### New Files
- `lib/curriculum/yearPlan.ts` — readiness targets, audit calculations, deterministic mapping engine, no-generation safeguards.
- `scripts/audit-curriculum-year-readiness.ts` — audit and optional `--map` command.
- `app/api/admin/curriculum/year-readiness/route.ts` — admin/MOE readiness API, CSV export, mapping trigger.
- `app/admin/curriculum/year-readiness/page.tsx` — Year Readiness Dashboard.
- `docs/roadmaps/school-operations-completion/PHASE_6_CONTENT_GENERATION_PROMPT.md` — Phase 6 handoff prompt.
- Tests:
  - `__tests__/curriculum/yearPlan.test.ts`
  - `__tests__/curriculum/yearReadiness.route.test.ts`
  - `__tests__/student.timetable-contentid-route.test.ts`

### Modified Files
- `app/api/student/work/[scheduledWorkId]/route.ts` — contentId timetable resolution and scheduled work bridge.
- `app/moe/curriculum/page.tsx` — adds full-year readiness panel and export link.
- `prisma/schema.prisma` — Phase 5 schema additions.

### Mapping Results
- Migration applied successfully via `npx dotenv -e .env.local -- npx prisma migrate deploy` with `DIRECT_URL` set to the reachable database URL for this command.
- Audit/mapping command completed: `npx dotenv -e .env.local -- npx tsx scripts/audit-curriculum-year-readiness.ts --map`.
- Existing mapped rows after audit: 88 grade/subject groups, 3,914 total lessons, 3,914 mapped lessons.
- Readiness range: 1% to 49% against 36 weeks × 5 lessons/week target.
- Coverage classification: 9 STRONG, 78 PARTIAL, 1 CRITICAL.
- The optimized mapper reported `generatedContent: false` and `duplicatedLessons: false`.

### Mapping Strategy
- Group existing approved/published/accepted curriculum by `grade + subject`.
- Sort deterministically by grade, subject, title, then `contentId`.
- Create 4-week unit chunks (each unit contains 2–6 weeks; actual target is 4 where possible).
- Create week records sequentially.
- Assign lesson days 1–5.
- Classify lesson types from existing metadata/text only; no content generation.
- Bulk-create lesson-plan rows with `skipDuplicates` and `mappedSource: EXISTING`.

### Dashboard Behavior
- Admin dashboard at `/admin/curriculum/year-readiness` shows readiness %, mapped lessons, weeks, units, missing content types, classification, mapping trigger, and CSV export.
- MOE curriculum page now shows mapped full-year readiness based on real API data and includes CSV export.
- No fake dashboard data added.

### Safety Confirmation
- NO content was generated.
- NO lessons were duplicated.
- Existing lesson access, scheduled work, timetable, adaptive plan, AI tutor, grading, and dashboards remain compatible.

### Gate Results (Phase 5)
| Gate                | Status                              |
| ------------------- | ----------------------------------- |
| npx prisma generate | PASS                                |
| npx tsc --noEmit    | PASS (0 errors)                     |
| npx vitest run      | PASS — 2267 tests, 309 files        |
| npm run build       | PASS                                |

### New Tests (Phase 5)
- `__tests__/curriculum/yearPlan.test.ts` — 4 tests
- `__tests__/curriculum/yearReadiness.route.test.ts` — 4 tests
- `__tests__/student.timetable-contentid-route.test.ts` — 1 test
- Total new: 9 tests

## Risks Active
- student.currentGrade backward compatibility: PRESERVED
- AcademicEnrollment unique constraint: RESPECTED
- TimetableAssignment migration: additive only (new table)
- lessonUrl in timetable uses `/student/lessons/<contentId>` — lesson page must handle contentId param
- Phase 4 is UX/API-only; no schema changes.
- Phase 5 content gaps remain real: readiness max is 49%, so Phase 6 should fill missing weeks/content types only after dry_run + approval.
- Phase 5 mapping is deterministic and idempotent, but first unoptimized script attempts timed out before bulk-create optimization; final optimized run completed.

## Next Phase
Phase 6 — Missing Content Generation (dry_run + approval first)

## Notes
Do not push unless explicitly instructed.
Run phases sequentially.
Safe to proceed to Phase 6: YES.
