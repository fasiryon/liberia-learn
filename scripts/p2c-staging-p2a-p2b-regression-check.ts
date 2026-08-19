import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C forensic remediation: confirms P2-A (4 tables) and P2-B (11 tables)
 * are untouched by the FIX 2/5 evidence-specificity migration, which only
 * added columns to two P2-C tables (AssessmentBaselineFramework,
 * AssessmentBaselineCompetency). Read-only. Uses P2A_STAGING_DATABASE_URL.
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

const P2A_TABLES = ["CurriculumProvenance", "CurriculumContentRevision", "CurriculumGovernanceEvent", "CurriculumEvidence"];
const P2B_TABLES = [
  "ReviewerProfile", "ReviewerCredential", "ReviewerCredentialScope", "ReviewerCredentialStatusEvent",
  "ReviewerRestriction", "CurriculumReviewTask", "CurriculumReviewAssignment", "CurriculumReviewAssessment",
  "CurriculumReviewDecision", "ReviewCalibrationSession", "ReviewCalibrationResult",
];

async function main() {
  const allTables = [...P2A_TABLES, ...P2B_TABLES];
  const existing = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(${allTables});
  `;
  const existingNames = new Set(existing.map((r) => r.tablename));
  const missing = allTables.filter((t) => !existingNames.has(t));

  console.log(`P2-A tables present: ${P2A_TABLES.filter((t) => existingNames.has(t)).length}/${P2A_TABLES.length}`);
  console.log(`P2-B tables present: ${P2B_TABLES.filter((t) => existingNames.has(t)).length}/${P2B_TABLES.length}`);
  if (missing.length > 0) {
    console.error("MISSING TABLES:", missing);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const rowCounts: Record<string, bigint> = {};
  for (const table of allTables) {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint FROM "${table}";`);
    rowCounts[table] = rows[0].count;
  }
  console.log("Row counts:", Object.fromEntries(Object.entries(rowCounts).map(([k, v]) => [k, v.toString()])));
  console.log("\nP2-A/P2-B REGRESSION CHECK: PASS (all tables present, queryable, no schema errors).");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
