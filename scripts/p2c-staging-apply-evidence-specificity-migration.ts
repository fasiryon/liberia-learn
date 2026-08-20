import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C forensic remediation FIX 2/5: applies
 * prisma/canonical/migrations/20260818_000001_p2c_evidence_specificity_and_baseline_depth/migration.sql
 * to staging directly via Prisma's raw execution (not `prisma migrate
 * deploy`, since prisma/p2c-staging.config.ts does not set a migrations
 * path and would otherwise resolve to the unrelated default
 * prisma/migrations directory -- the exact incident recorded in
 * docs/ops/P2C_STAGING_COMPLETION_RECORD.md). All 3 DDL statements are
 * additive-only (CREATE TYPE, 2x ADD COLUMN, 1x DROP DEFAULT) and run in a
 * single transaction. The _prisma_migrations ledger row is inserted
 * manually afterward with a checksum matching the committed file, exactly
 * as the two prior P2-C migrations were recorded.
 *
 * Preflight snapshots the pre-migration row counts and migration ledger for
 * a lightweight recovery point (no data is destroyed by this migration, so
 * a full pg_dump is not proportionate -- see the header comment for the
 * reasoning). Postflight re-verifies row counts are unchanged and the new
 * columns/enum exist with the expected backfilled values.
 *
 * Uses P2A_STAGING_DATABASE_URL. Refuses to run against production.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";
const MIGRATION_NAME = "20260818_000001_p2c_evidence_specificity_and_baseline_depth";
const MIGRATION_PATH = `prisma/canonical/migrations/${MIGRATION_NAME}/migration.sql`;

function assertStaging(): void {
  const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
  if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");
  if (!url.includes(STAGING_REF)) throw new Error("DATABASE_URL is not the approved staging project");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSING: URL touches the production project ref");
  process.env.DATABASE_URL = url;
}
assertStaging();

const prisma = new PrismaClient();

async function main() {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  console.log(`Migration file: ${MIGRATION_PATH}`);
  console.log(`Checksum: ${checksum}`);

  // --- Positive staging identity ---
  const [{ current_database: db }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database();`;
  console.log(`Connected database: ${db}`);

  // --- Preflight: already-applied check (idempotency guard) ---
  const already = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME};
  `;
  if (already.length > 0) {
    console.log(`Migration ${MIGRATION_NAME} is already recorded in the ledger. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  // --- Preflight: lightweight recovery point (row counts, ledger state) ---
  const preLedgerCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint FROM "_prisma_migrations";`;
  const preCompetencyCount = await prisma.assessmentBaselineCompetency.count();
  const preFrameworkCount = await prisma.assessmentBaselineFramework.count();
  const preCompetencyCodes = (await prisma.assessmentBaselineCompetency.findMany({ select: { code: true } })).map((r) => r.code).sort();
  console.log(`Preflight: ledger rows=${preLedgerCount[0].count}, AssessmentBaselineCompetency=${preCompetencyCount}, AssessmentBaselineFramework=${preFrameworkCount}`);
  console.log("Preflight competency codes:", preCompetencyCodes);

  // --- Apply: 3 additive statements in one transaction ---
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`CREATE TYPE "EvidenceSpecificity" AS ENUM ('FRAMEWORK_LEVEL', 'SUBJECT_LEVEL', 'TOPIC_LEVEL');`),
    prisma.$executeRawUnsafe(`ALTER TABLE "AssessmentBaselineFramework" ADD COLUMN "regionalReferenceLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`),
    prisma.$executeRawUnsafe(`ALTER TABLE "AssessmentBaselineCompetency" ADD COLUMN "evidenceSpecificity" "EvidenceSpecificity" NOT NULL DEFAULT 'SUBJECT_LEVEL';`),
    prisma.$executeRawUnsafe(`ALTER TABLE "AssessmentBaselineCompetency" ALTER COLUMN "evidenceSpecificity" DROP DEFAULT;`),
  ]);
  console.log("Applied 4 DDL statements (CREATE TYPE, 2x ALTER TABLE ADD COLUMN, 1x ALTER COLUMN DROP DEFAULT).");

  // --- Record ledger row, matching the two prior P2-C migrations' convention ---
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, rolled_back_at, started_at, applied_steps_count, finished_at)
    VALUES (${id}, ${checksum}, ${MIGRATION_NAME}, NULL, NULL, now(), 1, now());
  `;
  console.log(`Ledger row inserted: id=${id}`);

  // --- Postflight: row counts unchanged, new columns present, backfill honest ---
  const postCompetencyCount = await prisma.assessmentBaselineCompetency.count();
  const postFrameworkCount = await prisma.assessmentBaselineFramework.count();
  const postCompetencyCodes = (await prisma.assessmentBaselineCompetency.findMany({ select: { code: true } })).map((r) => r.code).sort();
  const specificityCounts = await prisma.assessmentBaselineCompetency.groupBy({ by: ["evidenceSpecificity"], _count: true });
  const postLedgerCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint FROM "_prisma_migrations";`;

  console.log(`\nPostflight: ledger rows=${postLedgerCount[0].count} (expect ${Number(preLedgerCount[0].count) + 1}), AssessmentBaselineCompetency=${postCompetencyCount} (expect ${preCompetencyCount}), AssessmentBaselineFramework=${postFrameworkCount} (expect ${preFrameworkCount})`);
  console.log("Postflight evidenceSpecificity distribution:", specificityCounts);

  const rowCountsMatch = postCompetencyCount === preCompetencyCount && postFrameworkCount === preFrameworkCount;
  const codesMatch = JSON.stringify(postCompetencyCodes) === JSON.stringify(preCompetencyCodes);
  const ledgerIncrementedByOne = Number(postLedgerCount[0].count) === Number(preLedgerCount[0].count) + 1;
  const allSubjectLevel = specificityCounts.every((row) => row.evidenceSpecificity === "SUBJECT_LEVEL");

  console.log(`\nInvariants: rowCountsMatch=${rowCountsMatch}, codesMatch=${codesMatch}, ledgerIncrementedByOne=${ledgerIncrementedByOne}, allExistingRowsBackfilledSubjectLevel=${allSubjectLevel}`);
  if (!rowCountsMatch || !codesMatch || !ledgerIncrementedByOne || !allSubjectLevel) {
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
