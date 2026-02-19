-- Add contact verification flags to School
ALTER TABLE "School" ADD COLUMN "contactEmailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "School" ADD COLUMN "contactPhoneVerified" BOOLEAN NOT NULL DEFAULT false;
