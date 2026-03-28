CREATE TABLE "StudentPerformanceEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT,
    "subject" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "aiAssistUsed" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentPerformanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConfusionSignal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT,
    "conceptTag" TEXT NOT NULL,
    "confusionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfusionSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterventionRecommendation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT,
    "recommendationType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterventionRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentPerformanceEvent_studentId_createdAt_idx" ON "StudentPerformanceEvent"("studentId", "createdAt");
CREATE INDEX "StudentPerformanceEvent_schoolId_subject_idx" ON "StudentPerformanceEvent"("schoolId", "subject");
CREATE INDEX "StudentPerformanceEvent_lessonId_idx" ON "StudentPerformanceEvent"("lessonId");

CREATE INDEX "ConfusionSignal_studentId_detectedAt_idx" ON "ConfusionSignal"("studentId", "detectedAt");
CREATE INDEX "ConfusionSignal_schoolId_severity_idx" ON "ConfusionSignal"("schoolId", "severity");

CREATE INDEX "InterventionRecommendation_studentId_createdAt_idx" ON "InterventionRecommendation"("studentId", "createdAt");
CREATE INDEX "InterventionRecommendation_schoolId_status_idx" ON "InterventionRecommendation"("schoolId", "status");

ALTER TABLE "StudentPerformanceEvent"
ADD CONSTRAINT "StudentPerformanceEvent_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConfusionSignal"
ADD CONSTRAINT "ConfusionSignal_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterventionRecommendation"
ADD CONSTRAINT "InterventionRecommendation_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
