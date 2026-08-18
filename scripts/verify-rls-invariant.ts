/**
 * Guardrail for the 2026-08-18 RLS exposure incident
 * (docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md).
 *
 * Postgres has no "RLS enabled by default" setting and Supabase-managed
 * projects cannot create event triggers (requires true superuser), so a new
 * Prisma/raw-SQL table can silently land with RLS off. Run this against
 * DATABASE_URL/DIRECT_URL for staging or production after every migration
 * (fail-closed: any table without RLS enabled is a hard failure).
 *
 * Usage: npx tsx scripts/verify-rls-invariant.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND NOT rowsecurity
    ORDER BY tablename;
  `;

  if (rows.length > 0) {
    console.error(
      `RLS INVARIANT VIOLATION: ${rows.length} public table(s) have Row Level Security disabled:`,
    );
    for (const row of rows) {
      console.error(`  - ${row.tablename}`);
    }
    console.error(
      "\nRun: ALTER TABLE \"<table>\" ENABLE ROW LEVEL SECURITY; for each table above. " +
        "See docs/security/PRODUCTION_RLS_EXPOSURE_AUDIT.md before adding policies.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("RLS invariant OK: all public tables have Row Level Security enabled.");
}

main()
  .catch((error) => {
    console.error("verify-rls-invariant failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
