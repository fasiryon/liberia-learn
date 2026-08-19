import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C blocker closure, distributed telemetry idempotency: applies
 * prisma/canonical/migrations/20260819_000001_p2c_ai_interaction_dedupekey_unique/migration.sql
 * to staging directly via Prisma's raw execution, for the same reason as
 * the prior P2-C migrations (prisma/p2c-staging.config.ts does not set a
 * migrations path and would otherwise resolve to the unrelated default
 * prisma/migrations directory).
 *
 * Both statements (DROP INDEX, CREATE UNIQUE INDEX) run in a single
 * transaction. Purely a constraint change -- no columns added/removed, no
 * data touched. Preflight re-verifies zero non-null dedupeKey conflicts
 * exist (the same check already run manually before writing the
 * migration); if that has changed since, this refuses to apply rather than
 * fail mid-transaction against surprise data.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";
const MIGRATION_NAME = "20260819_000001_p2c_ai_interaction_dedupekey_unique";
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

  const [{ current_database: db }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database();`;
  console.log(`Connected database: ${db}`);

  const already = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME};
  `;
  if (already.length > 0) {
    console.log(`Migration ${MIGRATION_NAME} is already recorded in the ledger. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  // --- Preflight: re-verify no non-null dedupeKey duplicates exist ---
  const dupes = await prisma.$queryRawUnsafe<Array<{ dedupeKey: string; c: bigint }>>(
    `SELECT "dedupeKey", COUNT(*) as c FROM "AIInteraction" WHERE "dedupeKey" IS NOT NULL GROUP BY "dedupeKey" HAVING COUNT(*) > 1`
  );
  if (dupes.length > 0) {
    console.error("REFUSING: found existing duplicate non-null dedupeKey values -- unique index would fail:", dupes);
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }
  const preLedgerCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint FROM "_prisma_migrations";`;
  const preInteractionCount = await prisma.aIInteraction.count();
  console.log(`Preflight: ledger rows=${preLedgerCount[0].count}, AIInteraction=${preInteractionCount}, non-null dedupeKey duplicate groups=0 (confirmed)`);

  // --- Apply: 2 statements in one transaction ---
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`DROP INDEX "AIInteraction_dedupeKey_idx";`),
    prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "AIInteraction_dedupeKey_key" ON "AIInteraction"("dedupeKey");`),
  ]);
  console.log("Applied 2 DDL statements (DROP INDEX, CREATE UNIQUE INDEX).");

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, rolled_back_at, started_at, applied_steps_count, finished_at)
    VALUES (${id}, ${checksum}, ${MIGRATION_NAME}, NULL, NULL, now(), 1, now());
  `;
  console.log(`Ledger row inserted: id=${id}`);

  // --- Postflight ---
  const postInteractionCount = await prisma.aIInteraction.count();
  const postLedgerCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint FROM "_prisma_migrations";`;
  const indexInfo = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'AIInteraction' AND indexname LIKE '%dedupeKey%';
  `;

  console.log(`\nPostflight: ledger rows=${postLedgerCount[0].count} (expect ${Number(preLedgerCount[0].count) + 1}), AIInteraction=${postInteractionCount} (expect ${preInteractionCount})`);
  console.log("dedupeKey indexes now:", indexInfo);

  const rowCountsMatch = postInteractionCount === preInteractionCount;
  const ledgerIncrementedByOne = Number(postLedgerCount[0].count) === Number(preLedgerCount[0].count) + 1;
  const uniqueIndexPresent = indexInfo.some((i) => i.indexname === "AIInteraction_dedupeKey_key" && i.indexdef.includes("UNIQUE"));
  const oldIndexGone = !indexInfo.some((i) => i.indexname === "AIInteraction_dedupeKey_idx");

  console.log(`\nInvariants: rowCountsMatch=${rowCountsMatch}, ledgerIncrementedByOne=${ledgerIncrementedByOne}, uniqueIndexPresent=${uniqueIndexPresent}, oldIndexGone=${oldIndexGone}`);
  if (!rowCountsMatch || !ledgerIncrementedByOne || !uniqueIndexPresent || !oldIndexGone) {
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
