-- WAVE-3E: OfflinePack model for bulk offline lesson zip downloads
CREATE TABLE "OfflinePack" (
    "id"            TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "classId"       TEXT,
    "studentId"     TEXT,
    "weekStart"     TIMESTAMP(3) NOT NULL,
    "weekEnd"       TIMESTAMP(3) NOT NULL,
    "audience"      TEXT NOT NULL DEFAULT 'student',
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "blobUrl"       TEXT,
    "blobKey"       TEXT,
    "sizeBytes"     INTEGER,
    "lessonCount"   INTEGER,
    "failureReason" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"   TIMESTAMP(3),
    "expiresAt"     TIMESTAMP(3),

    CONSTRAINT "OfflinePack_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfflinePack_requestedById_weekStart_idx" ON "OfflinePack"("requestedById", "weekStart");
CREATE INDEX "OfflinePack_status_idx" ON "OfflinePack"("status");
CREATE INDEX "OfflinePack_expiresAt_idx" ON "OfflinePack"("expiresAt");
