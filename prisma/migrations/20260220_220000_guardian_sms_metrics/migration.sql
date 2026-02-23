-- Guardian consent + SMS reliability + ops metrics foundations

CREATE TYPE "SMSMessageType" AS ENUM ('absence', 'at_risk', 'praise', 'custom');
CREATE TYPE "SMSDeliveryStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'blocked', 'opted_out');

CREATE TABLE "GuardianConsent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
  "optedOutAt" TIMESTAMP(3),
  "source" TEXT,
  "pilotOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianConsent_schoolId_studentId_guardianId_key"
  ON "GuardianConsent"("schoolId", "studentId", "guardianId");
CREATE INDEX "GuardianConsent_schoolId_pilotOnly_createdAt_idx"
  ON "GuardianConsent"("schoolId", "pilotOnly", "createdAt");

ALTER TABLE "GuardianConsent"
  ADD CONSTRAINT "GuardianConsent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianConsent"
  ADD CONSTRAINT "GuardianConsent_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianConsent"
  ADD CONSTRAINT "GuardianConsent_guardianId_fkey"
  FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SMSDeliveryLog" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "messageType" "SMSMessageType" NOT NULL,
  "templateKey" TEXT,
  "payloadJson" JSONB,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "status" "SMSDeliveryStatus" NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "pilotOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SMSDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SMSDeliveryLog_guardianId_messageType_idempotencyKey_key"
  ON "SMSDeliveryLog"("guardianId", "messageType", "idempotencyKey");
CREATE INDEX "SMSDeliveryLog_schoolId_createdAt_idx"
  ON "SMSDeliveryLog"("schoolId", "createdAt");
CREATE INDEX "SMSDeliveryLog_status_createdAt_idx"
  ON "SMSDeliveryLog"("status", "createdAt");
CREATE INDEX "SMSDeliveryLog_messageType_createdAt_idx"
  ON "SMSDeliveryLog"("messageType", "createdAt");

ALTER TABLE "SMSDeliveryLog"
  ADD CONSTRAINT "SMSDeliveryLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SMSDeliveryLog"
  ADD CONSTRAINT "SMSDeliveryLog_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SMSDeliveryLog"
  ADD CONSTRAINT "SMSDeliveryLog_guardianId_fkey"
  FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MetricEvent" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "scope" TEXT NOT NULL,
  "scopeId" TEXT,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "payloadJson" JSONB,
  "pilotOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  CONSTRAINT "MetricEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetricEvent_scope_scopeId_createdAt_idx"
  ON "MetricEvent"("scope", "scopeId", "createdAt");
CREATE INDEX "MetricEvent_name_createdAt_idx"
  ON "MetricEvent"("name", "createdAt");
CREATE INDEX "MetricEvent_severity_createdAt_idx"
  ON "MetricEvent"("severity", "createdAt");
CREATE INDEX "MetricEvent_schoolId_createdAt_idx"
  ON "MetricEvent"("schoolId", "createdAt");

ALTER TABLE "MetricEvent"
  ADD CONSTRAINT "MetricEvent_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetricEvent"
  ADD CONSTRAINT "MetricEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

