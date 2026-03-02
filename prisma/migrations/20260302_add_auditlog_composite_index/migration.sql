-- Gap 3: AuditLog composite index (schoolId, action, createdAt)
--
-- Hot paths:
--   1. GET /api/admin/compliance/audit-log — tenant-scoped search filtered by
--      action (contains) + optional date range.  schoolId prunes to tenant
--      partition; action narrows to event type; createdAt enables time-range scan.
--
--   2. buildMonthlyReportExport — counts audit events per action for a school
--      in a calendar-month window: WHERE schoolId=$1 AND createdAt BETWEEN $2 AND $3.
--
-- Index design:
--   schoolId FIRST  — prunes to the tenant before any other predicate.
--   action   SECOND — narrows to event class within the tenant partition.
--   createdAt THIRD — enables B-tree range scan for time-window queries.
--
-- Matches @@index([schoolId, action, createdAt]) in schema.prisma (line 444).
-- IF NOT EXISTS is safe to re-run on production.

CREATE INDEX IF NOT EXISTS "AuditLog_schoolId_action_createdAt_idx"
  ON "AuditLog"("schoolId", "action", "createdAt");
