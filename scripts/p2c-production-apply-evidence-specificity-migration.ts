import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Production-scoped equivalent of
 * scripts/p2c-staging-apply-evidence-specificity-migration.ts. Applies
 * prisma/canonical/migrations/20260818_000001_p2c_evidence_specificity_and_baseline_depth/migration.sql
 * to production via Prisma raw execution (same reasoning as the staging
 * script: prisma/p2c-staging.config.ts precedent aside, production has no
 * migrations-path config either, so this repeats the proven direct-apply
 * pattern rather than `prisma migrate deploy`). All 4 DDL statements are
 * additive-only (CREATE TYPE, 2x ALTER TABLE ADD COLUMN, 1x DROP DEFAULT)
 * and run in a single transaction. Requires the 20260817_000001 migration
 * (which creates AssessmentBaselineFramework/AssessmentBaselineCompetency)
 * to already be applied -- refuses to run otherwise.
 *
 * Uses DATABASE_URL. Refuses to run against staging.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";
const MIGRATION_NAME = "20260818_000001_p2c_evidence_specificity_and_baseline_depth";
const MIGRATION_PATH = `prisma/canonical/migrations/${MIGRATION_NAME}/migration.sql`;
const PREREQ_MIGRATION_NAME = "20260817_000001_p2c_waec_baseline_alignment";

function assertProduction(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required");
  if (!url.includes(`postgres.${PRODUCTION_REF}`)) throw new Error("DATABASE_URL is not the approved production project");
  if (url.includes(STAGING_REF)) throw new Error("REFUSING: URL touches the staging project ref");
}
assertProduction();

const prisma = new PrismaClient();

async function main() {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  console.log(`Migration file: ${MIGRATION_PATH}`);
  console.log(`Checksum: ${checksum}`);

  const [{ current_database: db }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database();`;
  console.log(`Connected database: ${db}`);

  const prereq = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${PREREQ_MIGRATION_NAME};
  `;
  if (prereq.length === 0) {
    throw new Error(`Prerequisite migration ${PREREQ_MIGRATION_NAME} is not yet applied. Refusing.`);
  }

  const already = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME};
  `;
  if (already.length > 0) {
    console.log(`Migration ${MIGRATION_NAME} is already recorded in the ledger. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const preLedgerCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint FROM "_prisma_migrations";`;
  const preCompetencyCount = await prisma.assessmentBaselineCompetency.count();
  const preFrameworkCount = await prisma.assessmentBaselineFramework.count();
  console.log(`Preflight: ledger rows=${preLedgerCount[0].count}, AssessmentBaselineCompetency=${preCompetencyCount}, AssessmentBaselineFramework=${preFrameworkCount}`);

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`CREATE TYPE "EvidenceSpecificity" AS ENUM ('FRAMEWORK_LEVEL', 'SUBJECT_LEVEL', 'TOPIC_LEVEL');`),
    prisma.$executeRawUnsafe(`ALTER TABLE "AssessmentBaselineFramework" ADD COLUMN "regionalReferenceLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`),
    prisma.$executeRawUnsafe(`ALTER TABLE "AssessmentBaselineCompetency" ADD COLUMN "evidenceSpecificity" "EvidenceSpecificity" NOT NULL DEFAULT 'SUBJECT_LEVEL';`),
    prisma.$executeRawUnsafe(`ALTER TABLE "AssessmentBaselineCompetency" ALTER COLUMN "evidenceSpecificity" DROP DEFAULT;`),
  ]);
  console.log("Applied 4 DDL statements (CREATE TYPE, 2x ALTER TABLE ADD COLUMN, 1x ALTER COLUMN DROP DEFAULT).");

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, rolled_back_at, started_at, applied_steps_count, finished_at)
    VALUES (${id}, ${checksum}, ${MIGRATION_NAME}, NULL, NULL, now(), 1, now());
  `;
  console.log(`Ledger row inserted: id=${id}`);

  const postCompetencyCount = await prisma.assessmentBaselineCompetency.count();
  const postFrameworkCount = await prisma.assessmentBaselineFramework.count();
  const postLedgerCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint FROM "_prisma_migrations";`;

  console.log(`\nPostflight: ledger rows=${postLedgerCount[0].count} (expect ${Number(preLedgerCount[0].count) + 1}), AssessmentBaselineCompetency=${postCompetencyCount} (expect ${preCompetencyCount}), AssessmentBaselineFramework=${postFrameworkCount} (expect ${preFrameworkCount})`);

  const rowCountsMatch = postCompetencyCount === preCompetencyCount && postFrameworkCount === preFrameworkCount;
  const ledgerIncrementedByOne = Number(postLedgerCount[0].count) === Number(preLedgerCount[0].count) + 1;

  console.log(`\nInvariants: rowCountsMatch=${rowCountsMatch}, ledgerIncrementedByOne=${ledgerIncrementedByOne}`);
  if (!rowCountsMatch || !ledgerIncrementedByOne) {
    console.error("POSTFLIGHT INVARIANT FAILURE");
    process.exitCode = 1;
  } else {
    console.log("\nMIGRATION APPLIED AND VERIFIED CLEAN.");
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
