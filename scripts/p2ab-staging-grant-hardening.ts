import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseSupabaseDatabaseTarget, PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/database-target";

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const TABLES = [
  "CurriculumProvenance",
  "CurriculumContentRevision",
  "CurriculumEvidence",
  "CurriculumGovernanceEvent",
  "ReviewerProfile",
  "ReviewerCredential",
  "ReviewerCredentialScope",
  "ReviewerCredentialStatusEvent",
  "ReviewerRestriction",
  "CurriculumReviewTask",
  "CurriculumReviewAssignment",
  "CurriculumReviewAssessment",
  "CurriculumReviewDecision",
  "ReviewCalibrationSession",
  "ReviewCalibrationResult",
  "AIReviewAgent",
  "CurriculumAIReviewAssessment",
  "AIInteraction",
  "AiInteractionLog",
  "AuditLog",
] as const;

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const target = parseSupabaseDatabaseTarget(databaseUrl, "DATABASE_URL");
if (target.projectRef === PRODUCTION_SUPABASE_PROJECT_REF || target.projectRef !== STAGING_REF) {
  throw new Error("Refusing to run outside the approved staging project");
}

const apply = process.argv.includes("--apply");
if (apply && process.env.P2AB_STAGING_GRANT_CHANGE_AUTHORIZED?.trim() !== "true") {
  throw new Error("--apply requires P2AB_STAGING_GRANT_CHANGE_AUTHORIZED=true");
}

const prisma = new PrismaClient();

async function currentGrants() {
  return prisma.$queryRawUnsafe<Array<{
    table_name: string;
    grantee: string;
    privilege_type: string;
  }>>(`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
      AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee, privilege_type
  `, [...TABLES]);
}

async function main() {
  const before = await currentGrants();
  console.log(JSON.stringify({
    mode: apply ? "APPLY" : "DRY_RUN",
    projectRef: target.projectRef,
    tableCount: TABLES.length,
    currentGrantRows: before.length,
    tablesWithGrants: [...new Set(before.map((row) => row.table_name))],
  }, null, 2));
  if (!apply) return;

  const quoted = TABLES.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`REVOKE ALL ON TABLE ${quoted} FROM anon, authenticated`);
  const after = await currentGrants();
  if (after.length) throw new Error(`Grant hardening incomplete: ${after.length} grant rows remain`);
  const smoke = await prisma.curriculumReviewTask.count();
  console.log(JSON.stringify({ applied: true, remainingGrantRows: 0, serviceSmokeCount: smoke }));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
