CREATE TABLE "StudentBadgeAward" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "studentId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "evidenceId" TEXT,
    "evidenceSummary" JSONB,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criteriaVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentBadgeAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentBadgeAward_studentId_badgeKey_criteriaVersion_key" ON "StudentBadgeAward"("studentId", "badgeKey", "criteriaVersion");
CREATE INDEX "StudentBadgeAward_schoolId_badgeKey_idx" ON "StudentBadgeAward"("schoolId", "badgeKey");
CREATE INDEX "StudentBadgeAward_studentId_awardedAt_idx" ON "StudentBadgeAward"("studentId", "awardedAt");

ALTER TABLE "StudentBadgeAward" ADD CONSTRAINT "StudentBadgeAward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentBadgeAward" ADD CONSTRAINT "StudentBadgeAward_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
