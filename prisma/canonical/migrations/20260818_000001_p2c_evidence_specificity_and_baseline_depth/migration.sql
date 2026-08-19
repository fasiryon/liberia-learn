-- P2-C forensic remediation, FIX 2 + FIX 5.
-- Additive only. No DROP, no destructive ALTER, no data loss.
--
-- FIX 2: persists AlignmentEvidence.evidenceSpecificity
-- (lib/curriculum/benchmarking/aiWaecAlignment.ts) onto
-- AssessmentBaselineCompetency itself. Previously this distinction existed
-- only in transient TypeScript arrays and a ".SUBJECT_LEVEL" code-suffix
-- naming convention, not as queryable, application-enforced state. All 16
-- existing staging AssessmentBaselineCompetency rows were individually
-- re-checked against their own evidenceLocator/expectation text (not just
-- their code suffix) before choosing the backfill default below; every one
-- is genuinely SUBJECT_LEVEL (each row's own expectation text states no
-- topic-by-topic WAEC syllabus was recovered for that competency). None is
-- upgraded to TOPIC_LEVEL by this migration.
--
-- FIX 5: adds a safe, separate home for regional/historical exam-name
-- references (e.g. "WASSCE" on WAEC.LIBERIA.LSHSCE.REGULAR) that does not
-- imply current first-party Liberia equivalence the way the existing
-- examAliases field would. Nothing in application code reads this new
-- column for baseline calculation.

-- CreateEnum
CREATE TYPE "EvidenceSpecificity" AS ENUM ('FRAMEWORK_LEVEL', 'SUBJECT_LEVEL', 'TOPIC_LEVEL');

-- AlterTable
ALTER TABLE "AssessmentBaselineFramework" ADD COLUMN "regionalReferenceLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
-- Backfill default matches every existing row's real, individually-verified
-- evidence (see comment above), then the default is dropped so every future
-- INSERT must classify evidenceSpecificity explicitly rather than inherit a
-- silent default.
ALTER TABLE "AssessmentBaselineCompetency" ADD COLUMN "evidenceSpecificity" "EvidenceSpecificity" NOT NULL DEFAULT 'SUBJECT_LEVEL';
ALTER TABLE "AssessmentBaselineCompetency" ALTER COLUMN "evidenceSpecificity" DROP DEFAULT;
