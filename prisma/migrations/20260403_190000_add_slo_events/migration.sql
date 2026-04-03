CREATE TABLE IF NOT EXISTS "SloEvent" (
  "id" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "schoolId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SloEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SloEvent_service_createdAt_idx"
  ON "SloEvent"("service", "createdAt");

CREATE INDEX IF NOT EXISTS "SloEvent_createdAt_idx"
  ON "SloEvent"("createdAt");

CREATE INDEX IF NOT EXISTS "SloEvent_schoolId_createdAt_idx"
  ON "SloEvent"("schoolId", "createdAt");

ALTER TABLE "SloEvent"
  ADD CONSTRAINT "SloEvent_schoolId_fkey"
  FOREIGN KEY ("schoolId")
  REFERENCES "School"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
