import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C forensic remediation FIX 8: revokes the broad anon/authenticated
 * grants that existed on the 13 P2-C tables (RLS was enabled with zero
 * policies -- default-deny -- but the underlying GRANT ALL from an earlier,
 * already-fixed default-privilege gap still applied to these specific
 * pre-existing tables; ALTER DEFAULT PRIVILEGES only affects tables created
 * after that fix, not these). No app code queries these tables via a
 * Supabase/PostgREST client under anon or authenticated (grep-verified,
 * server-only Prisma access under the postgres/service role only), so this
 * is safe to revoke in full. Idempotent (safe to re-run). Uses
 * P2A_STAGING_DATABASE_URL. Refuses to run against production.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";

function assertStaging(): void {
  const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
  if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");
  if (!url.includes(STAGING_REF)) throw new Error("DATABASE_URL is not the approved staging project");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSING: URL touches the production project ref");
  process.env.DATABASE_URL = url;
}
assertStaging();

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

  // Post-condition: the application's own Prisma connection must still work
  // against a representative P2-C table.
  const smoke = await prisma.assessmentBaselineFramework.count();
  console.log(`Application Prisma connection still works: assessmentBaselineFramework.count() = ${smoke}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
