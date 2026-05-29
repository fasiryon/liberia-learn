-- NR-14C: GradedSubmission — in-lesson essay and code auto-grading
-- Separate from HomeworkSubmission (teacher-assigned work).
-- Advisory grading only — score is never a hard gate.

CREATE TABLE IF NOT EXISTS "GradedSubmission" (
    "id"                 TEXT NOT NULL,
    "studentId"          TEXT NOT NULL,
    "lessonId"           TEXT NOT NULL,
    "exerciseType"       TEXT NOT NULL,
    "promptId"           TEXT,
    "submissionText"     TEXT NOT NULL,
    "score"              DOUBLE PRECISION,
    "maxScore"           DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rubricBreakdown"    JSONB,
    "feedback"           TEXT,
    "status"             TEXT NOT NULL DEFAULT 'pending',
    "gradedAt"           TIMESTAMP(3),
    "clientSubmissionId" TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradedSubmission_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS "GradedSubmission_clientSubmissionId_key"
    ON "GradedSubmission"("clientSubmissionId")
    WHERE "clientSubmissionId" IS NOT NULL;

-- Query indexes
CREATE INDEX IF NOT EXISTS "GradedSubmission_studentId_lessonId_idx"
    ON "GradedSubmission"("studentId", "lessonId");

CREATE INDEX IF NOT EXISTS "GradedSubmission_status_idx"
    ON "GradedSubmission"("status");

-- FK to Student (cascade delete — if a student is removed, their submissions go too)
ALTER TABLE "GradedSubmission"
    ADD CONSTRAINT "GradedSubmission_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE
    ON UPDATE CASCADE;
