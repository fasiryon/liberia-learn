-- Migration: 20260425_000000_teacher_onboarding
-- Adds teacherWelcomeCompletedAt to User for onboarding flow

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teacherWelcomeCompletedAt" TIMESTAMP(3);
