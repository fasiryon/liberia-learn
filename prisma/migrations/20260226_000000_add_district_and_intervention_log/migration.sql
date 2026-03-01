-- Add Role enum value for district administrators
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DISTRICT_ADMIN';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create District table
CREATE TABLE "District" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "code" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- Add districtId to School
ALTER TABLE "School" ADD COLUMN "districtId" TEXT;

-- Create InterventionLog table
CREATE TABLE "InterventionLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "districtId" TEXT,
  "interventionPriorityScore" DOUBLE PRECISION NOT NULL,
  "growthRiskFlag" TEXT NOT NULL,
  "recommendedActionCount" INTEGER NOT NULL,
  "aiEnhanced" BOOLEAN NOT NULL DEFAULT false,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "outcomeCheckedAt" TIMESTAMP(3),
  "outcomeDelta" DOUBLE PRECISION,

  CONSTRAINT "InterventionLog_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "School" ADD CONSTRAINT "School_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterventionLog" ADD CONSTRAINT "InterventionLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterventionLog" ADD CONSTRAINT "InterventionLog_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "District_tenantId_idx" ON "District"("tenantId");
CREATE INDEX "District_isActive_idx" ON "District"("isActive");
CREATE INDEX "InterventionLog_tenantId_generatedAt_idx" ON "InterventionLog"("tenantId", "generatedAt");
CREATE INDEX "InterventionLog_schoolId_generatedAt_idx" ON "InterventionLog"("schoolId", "generatedAt");
CREATE INDEX "InterventionLog_districtId_generatedAt_idx" ON "InterventionLog"("districtId", "generatedAt");
