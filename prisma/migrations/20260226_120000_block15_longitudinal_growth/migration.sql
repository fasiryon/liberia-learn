-- Block 15: Longitudinal monthly growth snapshots
-- Stores tenant-scoped per-student subject snapshots for monthly growth tracking.

CREATE TABLE "LongitudinalSnapshot" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "schoolId"       TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "subject"        "Subject" NOT NULL,
    "strandKey"      TEXT,
    "periodStart"    TIMESTAMP(3) NOT NULL,
    "periodType"     TEXT NOT NULL DEFAULT 'monthly',
    "score"          DOUBLE PRECISION NOT NULL,
    "growthRate"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classification" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LongitudinalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LongitudinalSnapshot_tenantId_schoolId_periodStart_idx"
  ON "LongitudinalSnapshot"("tenantId", "schoolId", "periodStart");

CREATE INDEX "LongitudinalSnapshot_schoolId_studentId_periodStart_idx"
  ON "LongitudinalSnapshot"("schoolId", "studentId", "periodStart");

CREATE INDEX "LongitudinalSnapshot_subject_strandKey_periodStart_idx"
  ON "LongitudinalSnapshot"("subject", "strandKey", "periodStart");

CREATE INDEX "LongitudinalSnapshot_classification_periodStart_idx"
  ON "LongitudinalSnapshot"("classification", "periodStart");
