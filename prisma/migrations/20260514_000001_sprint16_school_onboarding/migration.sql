-- Sprint 16: School Onboarding model
CREATE TABLE IF NOT EXISTS "SchoolOnboarding" (
    "id"          TEXT NOT NULL,
    "schoolId"    TEXT NOT NULL,
    "step"        INTEGER NOT NULL DEFAULT 1,
    "completed"   BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "metadata"    JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolOnboarding_schoolId_key"
    ON "SchoolOnboarding"("schoolId");

ALTER TABLE "SchoolOnboarding"
    ADD CONSTRAINT "SchoolOnboarding_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
