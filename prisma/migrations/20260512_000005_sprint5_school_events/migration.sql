-- Sprint 5: SchoolEvent model for school calendar with push + SMS notifications
CREATE TABLE "SchoolEvent" (
  "id"             TEXT        NOT NULL,
  "schoolId"       TEXT        NOT NULL,
  "title"          TEXT        NOT NULL,
  "description"    TEXT,
  "eventDate"      TIMESTAMP(3) NOT NULL,
  "endDate"        TIMESTAMP(3),
  "type"           TEXT        NOT NULL,
  "visibility"     TEXT        NOT NULL DEFAULT 'ALL',
  "sendSms"        BOOLEAN     NOT NULL DEFAULT false,
  "sendPush"       BOOLEAN     NOT NULL DEFAULT true,
  "published"      BOOLEAN     NOT NULL DEFAULT false,
  "createdBy"      TEXT        NOT NULL,
  "smsScheduledAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchoolEvent_schoolId_eventDate_idx"           ON "SchoolEvent"("schoolId", "eventDate");
CREATE INDEX "SchoolEvent_schoolId_published_eventDate_idx" ON "SchoolEvent"("schoolId", "published", "eventDate");
CREATE INDEX "SchoolEvent_type_published_eventDate_idx"     ON "SchoolEvent"("type", "published", "eventDate");

ALTER TABLE "SchoolEvent"
  ADD CONSTRAINT "SchoolEvent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
