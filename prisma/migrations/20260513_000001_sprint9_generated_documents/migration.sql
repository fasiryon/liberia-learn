-- Sprint 9: generated documents

CREATE TABLE "GeneratedDocument" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "canvaDesignId" TEXT,
  "canvaUrl" TEXT,
  "downloadUrl" TEXT,
  "metadata" JSONB,
  "requestedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "GeneratedDocument_schoolId_type_status_idx" ON "GeneratedDocument"("schoolId", "type", "status");
CREATE INDEX "GeneratedDocument_studentId_type_idx" ON "GeneratedDocument"("studentId", "type");
CREATE INDEX "GeneratedDocument_schoolId_createdAt_idx" ON "GeneratedDocument"("schoolId", "createdAt");
