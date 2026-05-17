-- Sprint 24: onboarding tour completion + privacy acceptance tracking
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tourCompletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3);
