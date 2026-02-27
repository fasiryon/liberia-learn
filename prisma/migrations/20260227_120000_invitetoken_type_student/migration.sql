-- Add token type + optional student binding for guardian linking
ALTER TABLE "InviteToken"
ADD COLUMN "tokenType" TEXT NOT NULL DEFAULT 'ONBOARD',
ADD COLUMN "studentId" TEXT,
ADD COLUMN "relation" TEXT;

ALTER TABLE "InviteToken"
ADD CONSTRAINT "InviteToken_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
