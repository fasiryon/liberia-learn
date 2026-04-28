-- Migration: 20260427_000000_academic_year_promotion
-- Add RETAINED and COMPLETED to AcademicEnrollmentStatus enum
-- Add promotedAt and updatedAt to AcademicEnrollment

ALTER TYPE "AcademicEnrollmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "AcademicEnrollmentStatus" ADD VALUE IF NOT EXISTS 'RETAINED';

ALTER TABLE "AcademicEnrollment"
  ADD COLUMN IF NOT EXISTS "promotedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
