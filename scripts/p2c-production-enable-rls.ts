import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Enables Row Level Security (default-deny, zero policies) on the 13 new
 * P2-C tables. Postgres does not enable RLS by default on CREATE TABLE, and
 * Supabase-managed projects cannot create event triggers to auto-enable it
 * (see docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md) -- the same gap that
 * incident already found and fixed for every pre-existing table. These 13
 * tables are new this cutover and were never covered by that fix. Found via
 * scripts/verify-rls-invariant.ts / scripts/p2c-production-grant-hardening.ts's
 * own RLS guard refusing to proceed. Idempotent (ENABLE ROW LEVEL SECURITY
 * on an already-enabled table is a no-op). Uses DATABASE_URL. Refuses to
 * run against staging.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";

function assertProduction(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required");
  if (!url.includes(`postgres.${PRODUCTION_REF}`)) throw new Error("DATABASE_URL is not the approved production project");
  if (url.includes(STAGING_REF)) throw new Error("REFUSING: URL touches the staging project ref");
}
assertProduction();

const prisma = new PrismaClient();

const P2C_TABLES = [
  "CurriculumAuthoritySource",
  "CurriculumAuthoritySourceVersion",
  "MoeCurriculumObjective",
  "AssessmentBaselineFramework",
  "AssessmentBaselineSubject",
  "AssessmentBaselineCompetency",
  "CurriculumBaselineAlignment",
  "CurriculumAlignmentValidityEvent",
  "CurriculumLearningTarget",
  "CurriculumCompetencyCoverage",
  "ExamPreparationProfile",
  "PolicyConfig",
  "PolicyOverride",
];

async function main() {
  for (const table of P2C_TABLES) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    console.log(`Enabled RLS on "${table}"`);
  }

  const rlsRows = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
    SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(${P2C_TABLES});
  `;
  const stillDisabled = rlsRows.filter((r) => !r.rowsecurity);
  console.log(`\nPostflight: ${rlsRows.length}/${P2C_TABLES.length} tables checked, ${stillDisabled.length} still RLS-disabled (expect 0).`);
  if (stillDisabled.length > 0) {
    console.error("STILL DISABLED:", stillDisabled);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
