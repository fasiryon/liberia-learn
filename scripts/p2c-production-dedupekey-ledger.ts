import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C production cutover: records the dedupeKey-unique migration in
 * production's _prisma_migrations ledger, AFTER
 * scripts/p2c-production-dedupekey-apply.sql has been run and
 * scripts/p2c-production-dedupekey-verify.sql has confirmed the resulting
 * index is unique/ready/valid.
 *
 * The checksum recorded here is computed from the UNCHANGED canonical
 * migration file (prisma/canonical/migrations/20260819_000001_p2c_ai_interaction_dedupekey_unique/migration.sql)
 * -- the same file staging's ledger entry was checksummed against. This is
 * intentional: this script's actual production DDL (p2c-production-dedupekey-apply.sql)
 * legitimately differs from that file's literal text (CONCURRENTLY vs.
 * plain, non-transactional vs. transactional), but Prisma's ledger only
 * ever compares migration NAME + FILE CHECKSUM to decide what's "applied"
 * -- it does not re-diff the live schema against the file's literal SQL.
 * Recording the same checksum as staging keeps `prisma migrate status`/
 * `deploy` healthy in both environments going forward: neither will ever
 * try to re-apply this migration, and neither will report a checksum
 * mismatch against the other.
 *
 * Refuses to run against anything but production. Refuses to run unless
 * the unique index already exists, is valid, and is ready (i.e. refuses to
 * paper over a DDL step that was skipped or failed). Idempotent: if the
 * ledger already has a row for this migration, does nothing.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";
const MIGRATION_NAME = "20260819_000001_p2c_ai_interaction_dedupekey_unique";
const MIGRATION_PATH = `prisma/canonical/migrations/${MIGRATION_NAME}/migration.sql`;

function assertProduction(): void {
  // Production scripts in this repo read DATABASE_URL directly (see
  // scripts/p2a-production-smoke.ts) -- .env.p2a-production.local sets
  // DATABASE_URL, not a separate P2A_PRODUCTION_DATABASE_URL name (that
  // convention is staging-only, see P2A_STAGING_DATABASE_URL).
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required");
  if (!url.includes(PRODUCTION_REF)) throw new Error("URL is not the approved production project");
  if (url.includes(STAGING_REF)) throw new Error("REFUSING: URL touches the staging project ref");
}
assertProduction();

const prisma = new PrismaClient();

async function main() {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  console.log(`Canonical migration file: ${MIGRATION_PATH}`);
  console.log(`Checksum (unchanged file, matches staging's ledger entry for the same name): ${checksum}`);

  const [{ current_database: db }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database();`;
  console.log(`Connected database: ${db}`);

  const already = await prisma.$queryRaw<{ migration_name: string; checksum: string }[]>`
    SELECT migration_name, checksum FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME};
  `;
  if (already.length > 0) {
    if (already[0].checksum !== checksum) {
      console.error(
        `LEDGER DRIFT: production already has a row for ${MIGRATION_NAME} with checksum ${already[0].checksum}, which does not match the canonical file's checksum ${checksum}. STOP -- do not proceed.`
      );
      process.exitCode = 1;
      await prisma.$disconnect();
      return;
    }
    console.log(`Migration ${MIGRATION_NAME} is already recorded in the ledger with a matching checksum. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  // Refuse to record the ledger row unless the DDL step actually succeeded.
  const indexState = await prisma.$queryRaw<
    Array<{ indisunique: boolean; indisready: boolean; indisvalid: boolean }>
  >`
    SELECT index_state.indisunique, index_state.indisready, index_state.indisvalid
    FROM pg_class AS index_class
    JOIN pg_index AS index_state ON index_state.indexrelid = index_class.oid
    JOIN pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
    WHERE namespace.nspname = 'public' AND index_class.relname = 'AIInteraction_dedupeKey_key';
  `;
  if (indexState.length !== 1 || !indexState[0].indisunique || !indexState[0].indisready || !indexState[0].indisvalid) {
    console.error(
      `REFUSING: AIInteraction_dedupeKey_key does not exist or is not unique/ready/valid (found: ${JSON.stringify(indexState)}). Run scripts/p2c-production-dedupekey-apply.sql and scripts/p2c-production-dedupekey-verify.sql first.`
    );
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, rolled_back_at, started_at, applied_steps_count, finished_at)
    VALUES (${id}, ${checksum}, ${MIGRATION_NAME}, NULL, NULL, now(), 1, now());
  `;
  console.log(`Ledger row inserted: id=${id}, checksum=${checksum} (matches the canonical file and staging's own entry).`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
