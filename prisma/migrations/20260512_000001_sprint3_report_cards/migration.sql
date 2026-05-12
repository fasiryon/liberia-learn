-- Sprint 3: Term Report Cards
CREATE TABLE IF NOT EXISTS "ReportCard" (
  "id"                TEXT        NOT NULL,
  "studentId"         TEXT        NOT NULL,
  "termId"            TEXT        NOT NULL,
  "schoolId"          TEXT        NOT NULL,
  "classId"           TEXT        NOT NULL,
  "subjectGrades"     JSONB       NOT NULL,
  "attendanceSummary" JSONB       NOT NULL,
  "teacherComment"    TEXT,
  "principalComment"  TEXT,
  "status"            TEXT        NOT NULL DEFAULT 'DRAFT',
  "generatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt"       TIMESTAMP(3),
  "createdBy"         TEXT        NOT NULL,
  CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ReportCard_studentId_termId_key"
  ON "ReportCard"("studentId", "termId");

CREATE INDEX IF NOT EXISTS "ReportCard_schoolId_termId_idx"
  ON "ReportCard"("schoolId", "termId");

CREATE INDEX IF NOT EXISTS "ReportCard_classId_termId_idx"
  ON "ReportCard"("classId", "termId");

CREATE INDEX IF NOT EXISTS "ReportCard_studentId_status_idx"
  ON "ReportCard"("studentId", "status");
