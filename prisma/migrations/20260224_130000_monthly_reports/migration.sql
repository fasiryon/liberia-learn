-- Block 8: Monthly Hybrid Reports
-- Adds the MonthlyReport table and ReportStatus enum.
--
-- Safety: additive only — no existing tables or columns modified.
-- Tenant isolation: schoolId column (nullable) scopes school-level reports;
--   all queries that touch school data must filter by schoolId.
-- Idempotency: the unique constraint on (scope, scopeId, month, subject)
--   combined with upsert in the ORM layer guarantees idempotent generation.
-- Tiers: tierCountsJson is INTERNAL ONLY (see ADR-0009).
--   Public views must never expose this column or its contents.

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "MonthlyReport" (
    "id"                  TEXT NOT NULL,
    "schoolId"            TEXT,
    "scope"               TEXT NOT NULL,
    "scopeId"             TEXT,
    "month"               TEXT NOT NULL,
    "subject"             TEXT NOT NULL DEFAULT '__ALL__',
    "status"              "ReportStatus" NOT NULL DEFAULT 'pending',
    "proficiencyRate"     DOUBLE PRECISION,
    "masteryRate"         DOUBLE PRECISION,
    "avgGrowthDelta"      DOUBLE PRECISION,
    "sustainabilityIndex" DOUBLE PRECISION,
    "aiRelianceRate"      DOUBLE PRECISION,
    "totalStudents"       INTEGER,
    "totalStrands"        INTEGER,
    "tierCountsJson"      JSONB,
    "payloadJson"         JSONB,
    "generatedAt"         TIMESTAMP(3),
    "generatedBy"         TEXT,
    "errorMessage"        TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReport_scope_scopeId_month_subject_key"
    ON "MonthlyReport"("scope", "scopeId", "month", "subject");

-- CreateIndex
CREATE INDEX "MonthlyReport_scope_scopeId_month_idx"
    ON "MonthlyReport"("scope", "scopeId", "month");

-- CreateIndex
CREATE INDEX "MonthlyReport_schoolId_month_idx"
    ON "MonthlyReport"("schoolId", "month");

-- CreateIndex
CREATE INDEX "MonthlyReport_status_createdAt_idx"
    ON "MonthlyReport"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MonthlyReport"
    ADD CONSTRAINT "MonthlyReport_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReport"
    ADD CONSTRAINT "MonthlyReport_generatedBy_fkey"
    FOREIGN KEY ("generatedBy") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
