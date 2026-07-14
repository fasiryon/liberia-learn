-- Sprint 6.1 round 3: Spec 5 (safeguarding) + Finding 1 (human-readable
-- Student ID). Additive, non-destructive. Both columns nullable.

ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "designatedSafetyStaffUserId" TEXT;
ALTER TABLE "School" ADD CONSTRAINT "School_designatedSafetyStaffUserId_fkey"
  FOREIGN KEY ("designatedSafetyStaffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "humanReadableStudentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Student_humanReadableStudentId_key" ON "Student" ("humanReadableStudentId");
