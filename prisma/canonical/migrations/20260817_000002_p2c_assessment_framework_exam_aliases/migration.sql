-- AlterTable
-- Additive only. Records alternate/regional names for a baseline framework
-- (e.g. LSHSCE's regional "WASSCE" alias) without creating a second,
-- competing framework row that could participate in baseline calculations.
ALTER TABLE "AssessmentBaselineFramework" ADD COLUMN "examAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
