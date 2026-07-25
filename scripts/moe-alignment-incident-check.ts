/**
 * scripts/moe-alignment-incident-check.ts
 *
 * Read-only. Phase 1 safety check: did an earlier killed background task's
 * attempted alignAllContent live write actually land any rows?
 *
 * Checks:
 * 1. Unfiltered total/checked count vs the known-good baseline (491/6192).
 * 2. Distribution of updatedAt for rows with non-null moeAlignments,
 *    looking for a recent tight cluster (a batch write signature).
 * 3. Most recent updatedAt on CurriculumContent overall.
 * 4. Malformed moeAlignments shape (missing standards[], non-array, etc).
 * 5. Any audit log rows for moe.align / MOE_OFFICIAL actions recently.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/moe-alignment-incident-check.ts
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.curriculumContent.count();

  const checkedReal = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM "CurriculumContent" WHERE "moeAlignments" IS NOT NULL
  `;
  const checkedCount = Number(checkedReal[0]?.n ?? 0);

  console.log(`\nBASELINE COMPARISON (unfiltered, all statuses):`);
  console.log(`  total (all CurriculumContent rows): ${total}   [baseline was 6192]`);
  console.log(`  checked (moeAlignments NOT NULL):    ${checkedCount}   [baseline was 491]`);
  console.log(`  delta vs baseline: total ${total - 6192 >= 0 ? "+" : ""}${total - 6192}, checked ${checkedCount - 491 >= 0 ? "+" : ""}${checkedCount - 491}`);

  // Most recent updatedAt overall
  const mostRecent = await prisma.curriculumContent.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, contentId: true, status: true, updatedAt: true, moeAlignments: true },
  });
  console.log(`\nMOST RECENTLY UPDATED CurriculumContent rows (any field):`);
  for (const row of mostRecent) {
    console.log(`  ${row.updatedAt.toISOString()}  status=${row.status}  hasAlignment=${row.moeAlignments != null}  id=${row.contentId}`);
  }

  // updatedAt distribution for aligned rows, bucketed by day
  const alignedRows = await prisma.$queryRaw<Array<{ day: string; n: bigint }>>`
    SELECT to_char("updatedAt", 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS n
    FROM "CurriculumContent"
    WHERE "moeAlignments" IS NOT NULL
    GROUP BY day
    ORDER BY day DESC
    LIMIT 20
  `;
  console.log(`\nALIGNED ROWS BY updatedAt DAY (top 20 most recent days with any aligned row):`);
  for (const row of alignedRows) {
    console.log(`  ${row.day}: ${row.n}`);
  }

  // Malformed shape check
  const malformed = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM "CurriculumContent"
    WHERE "moeAlignments" IS NOT NULL
      AND (
        jsonb_typeof("moeAlignments") != 'object'
        OR NOT ("moeAlignments" ? 'standards')
        OR jsonb_typeof("moeAlignments"->'standards') != 'array'
      )
  `;
  console.log(`\nMALFORMED moeAlignments shape (not the expected {standards:[...]} object): ${Number(malformed[0]?.n ?? 0)}`);

  const incidentRows = await prisma.$queryRaw<Array<{
    id: string;
    contentId: string;
    status: string;
    updatedAt: Date;
    method: string | null;
    standardCount: number;
  }>>`
    SELECT
      id,
      "contentId",
      status,
      "updatedAt",
      "moeAlignments"->>'method' AS method,
      jsonb_array_length(COALESCE("moeAlignments"->'standards', '[]'::jsonb)) AS "standardCount"
    FROM "CurriculumContent"
    WHERE jsonb_typeof("moeAlignments") = 'object'
      AND "updatedAt" >= '2026-07-24T16:45:00.000Z'::timestamptz
      AND "updatedAt" <= '2026-07-24T16:50:00.000Z'::timestamptz
    ORDER BY "updatedAt" ASC, id ASC
  `;

  const matchedIncidentRows = incidentRows.filter((row) => row.standardCount > 0);
  const emptyIncidentRows = incidentRows.filter((row) => row.standardCount === 0);
  const keywordIncidentRows = incidentRows.filter((row) => row.method === "keyword");
  const aiIncidentRows = incidentRows.filter((row) => row.method === "ai");
  const incidentContentIds = incidentRows.map((row) => row.contentId);

  const [scheduledWorkRows, assignmentRows] = await Promise.all([
    prisma.scheduledWork.findMany({
      where: { contentId: { in: incidentContentIds } },
      select: { id: true, contentId: true },
    }),
    prisma.assignment.findMany({
      where: { contentId: { in: incidentContentIds } },
      select: { id: true, contentId: true },
    }),
  ]);

  const scheduledWorkIds = scheduledWorkRows.map((row) => row.id);
  const progressCount = scheduledWorkIds.length > 0
    ? await prisma.studentProgress.count({
        where: { scheduledWorkId: { in: scheduledWorkIds } },
      })
    : 0;

  console.log(`\nINCIDENT WINDOW 2026-07-24T16:45:00Z through 2026-07-24T16:50:00Z:`);
  console.log(`  Object-shaped writes: ${incidentRows.length}`);
  console.log(`  Genuine non-empty matches: ${matchedIncidentRows.length}`);
  console.log(`  Empty standards results: ${emptyIncidentRows.length}`);
  console.log(`  Methods: keyword=${keywordIncidentRows.length}, ai=${aiIncidentRows.length}`);
  console.log(`  ScheduledWork references: ${scheduledWorkRows.length}`);
  console.log(`  StudentProgress references through ScheduledWork: ${progressCount}`);
  console.log(`  Assignment references: ${assignmentRows.length}`);
  console.log(`\nEXACT INCIDENT ROWS:`);
  for (const row of incidentRows) {
    console.log(
      `  ${row.updatedAt.toISOString()} id=${row.id} contentId=${row.contentId} status=${row.status} method=${row.method ?? "null"} standards=${row.standardCount}`
    );
  }

  // Recent audit log entries for MOE alignment actions
  const auditRows = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { contains: "align", mode: "insensitive" } },
        { action: { contains: "moe", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, action: true, createdAt: true, userId: true, resourceType: true, resourceId: true, details: true },
  });
  console.log(`\nRECENT AuditLog rows matching 'align' or 'moe' (most recent 20):`);
  if (auditRows.length === 0) {
    console.log("  (none found)");
  }
  for (const row of auditRows) {
    console.log(`  ${row.createdAt.toISOString()}  ${row.action}  user=${row.userId ?? "n/a"}  resource=${row.resourceType}/${row.resourceId}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
