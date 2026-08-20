import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C forensic remediation FIX 8: audits current anon/authenticated grants
 * on the 13 P2-C tables (plus the 2 policy tables the same migration added)
 * before revoking anything. Read-only. Uses P2A_STAGING_DATABASE_URL.
 * Refuses to run against production.
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
  const grants = await prisma.$queryRaw<{ table_name: string; grantee: string; privilege_type: string }[]>`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = ANY(${P2C_TABLES})
      AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee, privilege_type;
  `;
  const rls = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = ANY(${P2C_TABLES})
    ORDER BY tablename;
  `;
  const policies = await prisma.$queryRaw<{ tablename: string; policyname: string }[]>`
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(${P2C_TABLES})
    ORDER BY tablename;
  `;

  console.log("=== RLS status ===");
  console.log(rls);
  console.log("\n=== Existing policies (expect zero) ===");
  console.log(policies);
  console.log("\n=== anon/authenticated grants ===");
  console.log(grants);

  const byTable = new Map<string, { anon: Set<string>; authenticated: Set<string> }>();
  for (const table of P2C_TABLES) byTable.set(table, { anon: new Set(), authenticated: new Set() });
  for (const grant of grants) {
    const entry = byTable.get(grant.table_name);
    if (!entry) continue;
    (entry as Record<string, Set<string>>)[grant.grantee].add(grant.privilege_type);
  }

  console.log("\n=== Per-table summary ===");
  for (const [table, entry] of byTable) {
    console.log(`${table}: anon=[${[...entry.anon].join(",")}] authenticated=[${[...entry.authenticated].join(",")}]`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
