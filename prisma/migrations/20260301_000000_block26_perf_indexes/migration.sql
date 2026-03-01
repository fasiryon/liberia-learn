-- Block 26: Performance Hardening — National Load Indexes
-- Adds composite indexes on the two highest-impact hot paths identified
-- during the Block 26 performance audit.
--
-- Index design principles:
--   1. Tenant scoping key (schoolId/studentId) FIRST — prunes to tenant
--      set before applying secondary predicates.
--   2. Range predicate column SECOND — leverages B-tree range scan within
--      the tenant partition.
--   3. IF NOT EXISTS — safe to re-run on production with live data.
--   4. No CONCURRENTLY — compatible with Prisma's transaction wrapper.

-- 1. StudentMasteryProfile(studentId, lastAssessedAt)
--    Hot path: trendAggregator.computeSchoolTrends() — runs N bucket
--    aggregates per school per district trend report.
--    Query: WHERE student.user.schoolId = $1 AND lastAssessedAt BETWEEN $2 AND $3
--    Without index: full scan of StudentMasteryProfile joined to User(schoolId).
--    With index: range scan on (studentId, lastAssessedAt) — orders of magnitude
--    faster at national scale (1M+ mastery profiles across 5,000 schools).
CREATE INDEX IF NOT EXISTS "StudentMasteryProfile_studentId_lastAssessedAt_idx"
  ON "StudentMasteryProfile"("studentId", "lastAssessedAt");

-- 2. VirtualLab(status, grade, schoolId)
--    Hot path: POST /api/teacher/schedule — virtual lab auto-binding on every
--    lesson scheduled. Queries: WHERE status='published' AND grade=$1
--    AND (schoolId IS NULL OR schoolId=$2).
--    Without index: full scan of VirtualLab table (grows with every school's labs).
--    With index: instant lookup for published labs by grade and school.
--    schoolId placed THIRD after status+grade because the OR condition
--    (schoolId IS NULL OR schoolId=school) cannot use a leading schoolId index.
CREATE INDEX IF NOT EXISTS "VirtualLab_status_grade_schoolId_idx"
  ON "VirtualLab"("status", "grade", "schoolId");

-- 3. AssignmentSubmission(turnedInAt, assignmentId)
--    Hot path: trendAggregator evidence-velocity bucket count.
--    Query: WHERE Assignment.Class.schoolId = $1 AND turnedInAt BETWEEN $2 AND $3
--    The existing AssignmentSubmission_studentId_turnedInAt_idx covers
--    studentId-first scans; this index covers date-range scans joined
--    through Assignment → Class → schoolId.
CREATE INDEX IF NOT EXISTS "AssignmentSubmission_turnedInAt_assignmentId_idx"
  ON "AssignmentSubmission"("turnedInAt", "assignmentId");
