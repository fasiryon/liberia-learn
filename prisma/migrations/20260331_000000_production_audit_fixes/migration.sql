-- Production Audit Sprint — 2026-03-31
-- Applies: Exam soft-delete, Student soft-delete,
--          AuditLog userId onDelete SetNull,
--          PlatformTransferToken intendedUserId + tokenHash

-- 1. Exam soft-delete field
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 2. Student soft-delete field
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 3. PlatformTransferToken: intendedUserId + tokenHash
ALTER TABLE "PlatformTransferToken" ADD COLUMN IF NOT EXISTS "intendedUserId" TEXT;
ALTER TABLE "PlatformTransferToken" ADD COLUMN IF NOT EXISTS "tokenHash" TEXT;

-- 4. AuditLog.userId → onDelete SetNull
--    The FK constraint name may vary; drop and recreate with SET NULL.
DO $$
BEGIN
  -- Drop existing FK if present (constraint name from Prisma default)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AuditLog_userId_fkey'
      AND table_name = 'AuditLog'
  ) THEN
    ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";
  END IF;

  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
END $$;
