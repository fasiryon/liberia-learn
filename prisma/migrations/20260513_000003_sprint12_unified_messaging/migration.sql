-- Sprint 12: Unified Messaging — extend Message model + add MessageReadReceipt

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "senderRole"    TEXT NOT NULL DEFAULT 'GUARDIAN';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "recipientRole" TEXT NOT NULL DEFAULT 'TEACHER';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "threadKey"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "read"          BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "MessageReadReceipt" (
    "id"        TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "readAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MessageReadReceipt"
    ADD CONSTRAINT "MessageReadReceipt_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessageReadReceipt"
    ADD CONSTRAINT "MessageReadReceipt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "MessageReadReceipt_messageId_userId_key"
    ON "MessageReadReceipt"("messageId", "userId");

CREATE INDEX IF NOT EXISTS "Message_threadKey_createdAt_idx" ON "Message"("threadKey", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_toUserId_createdAt_idx"  ON "Message"("toUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_fromUserId_createdAt_idx" ON "Message"("fromUserId", "createdAt");
