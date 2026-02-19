ALTER TABLE "AuditLog" ADD COLUMN "schoolId" TEXT;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_schoolId_action_createdAt_idx"
ON "AuditLog"("schoolId", "action", "createdAt");
