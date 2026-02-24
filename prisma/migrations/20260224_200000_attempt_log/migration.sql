CREATE TABLE "AttemptLog" (
    "id"              TEXT NOT NULL,
    "studentId"       TEXT NOT NULL,
    "subject"         "Subject" NOT NULL,
    "strandKey"       TEXT NOT NULL,
    "correct"         INTEGER NOT NULL,
    "total"           INTEGER NOT NULL,
    "source"          TEXT NOT NULL,
    "difficulty"      INTEGER,
    "wasAiAssisted"   BOOLEAN NOT NULL DEFAULT false,
    "timestamp"       TIMESTAMP(3) NOT NULL,
    "idempotencyKey"  TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttemptLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttemptLog_idempotencyKey_key" ON "AttemptLog"("idempotencyKey");
CREATE INDEX "AttemptLog_studentId_idx" ON "AttemptLog"("studentId");
CREATE INDEX "AttemptLog_studentId_subject_strandKey_idx"
    ON "AttemptLog"("studentId", "subject", "strandKey");

ALTER TABLE "AttemptLog"
    ADD CONSTRAINT "AttemptLog_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
