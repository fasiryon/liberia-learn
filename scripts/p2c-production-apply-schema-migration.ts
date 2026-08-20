import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Production-scoped equivalent of
 * scripts/p2c-staging-apply-evidence-specificity-migration.ts, generalized
 * to apply either of the two purely-additive P2-C schema migrations
 * (20260817_000001_p2c_waec_baseline_alignment,
 * 20260817_000002_p2c_assessment_framework_exam_aliases) to production via
 * Prisma raw execution + manual ledger insert, exactly mirroring how the
 * same two files were already applied to staging.
 *
 * Both migrations are additive-only (CREATE TYPE / CREATE TABLE / CREATE
 * INDEX / ADD CONSTRAINT for the first; a single ADD COLUMN for the second)
 * -- no DROP, no ALTER on existing live tables' existing columns, no data
 * rewrite. Neither contains dollar-quoted blocks or embedded semicolons in
 * string content, so the file is split into individual statements on a
 * bare `;` followed by whitespace, each executed via $executeRawUnsafe
 * inside one transaction. Statement count is cross-checked against the
 * file's own `-- CreateEnum` / `-- CreateTable` / `-- CreateIndex` /
 * `-- AddForeignKey` / `-- AlterTable` comment markers before running
 * anything, as a guard against a parsing mistake silently dropping or
 * merging a statement.
 *
 * Usage: npx tsx scripts/p2c-production-apply-schema-migration.ts <migration-name>
 * Requires DATABASE_URL set to production's transaction pooler.
 */

const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";
const STAGING_REF = "yonpfzjczoffhrgibxkz";

const migrationName = process.argv[2];
if (!migrationName) {
  throw new Error("Usage: npx tsx scripts/p2c-production-apply-schema-migration.ts <migration-name>");
}
const ALLOWED = [
  "20260817_000001_p2c_waec_baseline_alignment",
  "20260817_000002_p2c_assessment_framework_exam_aliases",
];
if (!ALLOWED.includes(migrationName)) {
  throw new Error(`Refusing: ${migrationName} is not one of the allowlisted schema migrations: ${ALLOWED.join(", ")}`);
}
const MIGRATION_PATH = `prisma/canonical/migrations/${migrationName}/migration.sql`;

function assertProduction(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required");
  if (!url.includes(`postgres.${PRODUCTION_REF}`)) throw new Error("DATABASE_URL is not the approved production project");
  if (url.includes(STAGING_REF)) throw new Error("REFUSING: URL touches the staging project ref");
}
assertProduction();

const prisma = new PrismaClient();

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function countMarkers(sql: string): number {
  const markers = sql.match(/^-- (CreateEnum|CreateTable|CreateIndex|AddForeignKey|AlterTable)$/gm);
  return markers ? markers.length : 0;
}

async function main() {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  console.log(`Migration file: ${MIGRATION_PATH}`);
  console.log(`Checksum: ${checksum}`);

  const [{ current_database: db }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database();`;
  console.log(`Connected database: ${db}`);

  const already = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${migrationName};
  `;
  if (already.length > 0) {
    console.log(`Migration ${migrationName} is already recorded in the ledger. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const statements = splitStatements(sql);
  const expectedCount = countMarkers(sql);
  console.log(`Parsed ${statements.length} statements; expected ${expectedCount} from comment markers.`);
  if (statements.length !== expectedCount) {
    throw new Error(
      `Statement parse count (${statements.length}) does not match comment-marker count (${expectedCount}) -- refusing to apply.`
    );
  }

  const preLedgerCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint FROM "_prisma_migrations";`;
  const preTableCount = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `;
  console.log(`Preflight: ledger rows=${preLedgerCount[0].count}, public tables=${preTableCount[0].count}`);

  await prisma.$transaction(
    statements.map((stmt) => prisma.$executeRawUnsafe(stmt)),
    { timeout: 60000 }
  );
  console.log(`Applied ${statements.length} DDL statements in one transaction.`);

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, rolled_back_at, started_at, applied_steps_count, finished_at)
    VALUES (${id}, ${checksum}, ${migrationName}, NULL, NULL, now(), 1, now());
  `;
  console.log(`Ledger row inserted: id=${id}`);

  const postLedgerCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint FROM "_prisma_migrations";`;
  const postTableCount = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `;
  console.log(`Postflight: ledger rows=${postLedgerCount[0].count} (expect ${Number(preLedgerCount[0].count) + 1}), public tables=${postTableCount[0].count} (was ${preTableCount[0].count})`);

  const ledgerIncrementedByOne = Number(postLedgerCount[0].count) === Number(preLedgerCount[0].count) + 1;
  if (!ledgerIncrementedByOne) {
    console.error("POSTFLIGHT INVARIANT FAILURE: ledger did not increment by exactly one.");
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
