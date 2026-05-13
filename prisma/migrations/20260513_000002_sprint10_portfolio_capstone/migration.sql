-- Sprint 10: portfolio + capstone extensions

-- Extend CapstoneProject with missing fields
ALTER TABLE "CapstoneProject" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "CapstoneProject" ADD COLUMN IF NOT EXISTS "skills" JSONB;
ALTER TABLE "CapstoneProject" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;
ALTER TABLE "CapstoneProject" ADD COLUMN IF NOT EXISTS "fileUrls" JSONB;
ALTER TABLE "CapstoneProject" ADD COLUMN IF NOT EXISTS "teacherFeedback" TEXT;
ALTER TABLE "CapstoneProject" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "CapstoneProject" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "CapstoneProject" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CapstoneProject" ADD CONSTRAINT "CapstoneProject_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CapstoneProject_studentId_status_idx" ON "CapstoneProject"("studentId", "status");
CREATE INDEX IF NOT EXISTS "CapstoneProject_teacherId_status_idx" ON "CapstoneProject"("teacherId", "status");

-- Add PortfolioShare model
CREATE TABLE IF NOT EXISTS "PortfolioShare" (
  "id"        TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "shareCode" TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioShare_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PortfolioShare" ADD CONSTRAINT "PortfolioShare_shareCode_key" UNIQUE ("shareCode");
ALTER TABLE "PortfolioShare" ADD CONSTRAINT "PortfolioShare_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PortfolioShare_studentId_isActive_idx" ON "PortfolioShare"("studentId", "isActive");
