-- Block 23: Database Performance Hardening (Phase 5 Bundle A)
-- Adds composite indexes on hot query paths for national-scale load.
-- All indexes place the tenant/class scoping key FIRST to enforce
-- multi-tenant isolation intent at the schema level and allow the
-- query planner to prune tenants before scanning time ranges.
--
-- Safe to apply to production: CREATE INDEX CONCURRENTLY would be
-- preferred in a live cluster; remove CONCURRENTLY if the DB engine
-- does not support it within a transaction block.

-- 1. Enrollment(classId)
--    Hot path: class roster lookups in risk-summary and teacher growth routes.
--    The existing unique index is (studentId, classId) — this one adds a
--    classId-first entry point for queries filtering by classId IN [...].
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Enrollment_classId_idx"
  ON "Enrollment"("classId");

-- 2. Meeting(classId, startsAt)
--    Hot path: attendance window queries in risk-summary routes.
--    Queries filter Meeting WHERE classId IN [...] AND startsAt BETWEEN.
--    classId FIRST ensures the planner prunes to the relevant class set
--    before applying the time range predicate.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Meeting_classId_startsAt_idx"
  ON "Meeting"("classId", "startsAt");

-- 3. HomeworkSubmission(studentId, submittedAt)
--    Hot path: evidence-velocity queries in class/school risk routes.
--    Queries: WHERE studentId IN [...] AND submittedAt BETWEEN [prior, now].
--    studentId FIRST scopes to the tenant's student set; submittedAt
--    enables efficient range pruning within that set.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "HomeworkSubmission_studentId_submittedAt_idx"
  ON "HomeworkSubmission"("studentId", "submittedAt");

-- 4. AssignmentSubmission(studentId, turnedInAt)
--    Hot path: assignment completion queries in class/school risk routes.
--    Same pattern as HomeworkSubmission above.
--    The existing unique index is (assignmentId, studentId); this adds
--    a studentId-first entry for time-range evidence queries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssignmentSubmission_studentId_turnedInAt_idx"
  ON "AssignmentSubmission"("studentId", "turnedInAt");
