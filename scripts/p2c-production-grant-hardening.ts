import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Production-scoped equivalent of scripts/p2c-staging-grant-hardening.ts.
 * Revokes anon/authenticated grants on the 13 P2-C tables (RLS is enabled
 * with zero policies -- default-deny -- but the pre-existing GRANT ALL
 * default-privilege gap this session's earlier RLS-exposure fix predates
 * still applies to any table that existed before that fix landed; these
 * tables are newly created this cutover, but ALTER DEFAULT PRIVILEGES only
 * governs future object creation from the moment it was set, so a fresh
 * revoke is the correct belt-and-suspenders check here regardless). No app
 * code queries these tables via a Supabase/PostgREST client under anon or
 * authenticated -- server-only Prisma access under the postgres/service
 * role only. Idempotent. Uses DATABASE_URL. Refuses to run against staging.
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
  const rlsRows = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
    SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(${P2C_TABLES});
  `;
  const rlsDisabled = rlsRows.filter((r) => !r.rowsecurity);
  console.log(`RLS check: ${rlsRows.length}/${P2C_TABLES.length} P2-C tables found, ${rlsDisabled.length} with RLS disabled (expect 0).`);
  if (rlsDisabled.length > 0) {
    console.error("RLS DISABLED on:", rlsDisabled);
    process.exitCode = 1;
    return;
  }

  const quotedTables = P2C_TABLES.map((t) => `"${t}"`).join(", ");
  console.log(`Revoking ALL privileges from anon, authenticated on: ${P2C_TABLES.join(", ")}`);
  await prisma.$executeRawUnsafe(`REVOKE ALL ON TABLE ${quotedTables} FROM anon, authenticated;`);
  console.log("Revoke statement executed.");

  const remaining = await prisma.$queryRaw<{ table_name: string; grantee: string; privilege_type: string }[]>`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = ANY(${P2C_TABLES})
      AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee, privilege_type;
  `;
  console.log(`\nRemaining anon/authenticated grants after revoke: ${remaining.length} (expect 0)`);
  if (remaining.length > 0) {
    console.error(remaining);
    process.exitCode = 1;
  }

  const smoke = await prisma.assessmentBaselineFramework.count();
  console.log(`Application Prisma connection still works: assessmentBaselineFramework.count() = ${smoke}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
