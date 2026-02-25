-- Block 12A: Impact Snapshot table
-- Append-only rollup of tenant-scoped impact computation results.
-- No student identifiers. No foreign keys to student tables (snapshot = denormalized log).

CREATE TABLE "ImpactSnapshot" (
    "id"                      TEXT NOT NULL,
    "tenantId"                TEXT NOT NULL,
    "schoolId"                TEXT,
    "classId"                 TEXT,
    "period"                  TEXT NOT NULL,
    "proficiencyRate"         DOUBLE PRECISION NOT NULL,
    "avgMasteryScore"         DOUBLE PRECISION NOT NULL,
    "masteryDelta"            DOUBLE PRECISION NOT NULL,
    "growthDelta"             DOUBLE PRECISION NOT NULL,
    "effectSize"              DOUBLE PRECISION,
    "statisticallyMeaningful" BOOLEAN NOT NULL,
    "confidenceLabel"         TEXT NOT NULL,
    "sampleSize"              INTEGER NOT NULL DEFAULT 0,
    "generatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpactSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImpactSnapshot_tenantId_period_idx"  ON "ImpactSnapshot"("tenantId", "period");
CREATE INDEX "ImpactSnapshot_schoolId_period_idx"  ON "ImpactSnapshot"("schoolId", "period");
CREATE INDEX "ImpactSnapshot_classId_period_idx"   ON "ImpactSnapshot"("classId", "period");
CREATE INDEX "ImpactSnapshot_generatedAt_idx"       ON "ImpactSnapshot"("generatedAt");
