-- Add pilot metadata fields to School
ALTER TABLE "School" ADD COLUMN "pilotStatus" TEXT;
ALTER TABLE "School" ADD COLUMN "pilotCohort" TEXT;
ALTER TABLE "School" ADD COLUMN "pilotStartDate" TIMESTAMP(3);
ALTER TABLE "School" ADD COLUMN "pilotNotes" TEXT;
