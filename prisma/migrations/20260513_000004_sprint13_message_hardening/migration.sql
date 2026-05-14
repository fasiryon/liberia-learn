-- Sprint 13: Message hardening — soft-delete, flag workflow, attachment fields

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deletedBySender"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deletedAt"         TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "flagged"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "flagReason"        TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "flaggedAt"         TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "flagReviewedAt"    TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "flagReviewedBy"    TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "flagResolution"    TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentUrl"     TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentName"    TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentType"    TEXT;

CREATE INDEX IF NOT EXISTS "Message_flagged_idx" ON "Message"("flagged");
