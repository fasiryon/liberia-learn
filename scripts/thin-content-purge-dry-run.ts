/**
 * scripts/thin-content-purge-dry-run.ts
 *
 * Read-only. Identifies the unattached-thin-lesson purge candidate set
 * (matchable text < 300 chars AND zero ScheduledWork/Assignment reference),
 * re-derived fresh (not reused from the earlier investigation's snapshot),
 * and exports a full JSON backup to archive/ before any real delete runs.
 *
 * Does NOT delete anything. Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/thin-content-purge-dry-run.ts
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const THIN_THRESHOLD = 300;

function extractLessonText(payload: any): string {
  const textParts: string[] = [];
  if (payload) {
    for (const key of ["title", "description", "objectives", "content", "summary", "lessonPlan"]) {
      const val = payload[key];
      if (typeof val === "string") textParts.push(val);
      else if (Array.isArray(val)) textParts.push(val.filter((v: any) => typeof v === "string").join(" "));
      else if (typeof val === "object" && val) textParts.push(JSON.stringify(val));
    }
  }
  return textParts.join(" ").toLowerCase();
}

async function main() {
  const { prisma } = await import("@/lib/db");

  const allContent = await prisma.curriculumContent.findMany({
    select: {
      id: true,
      contentId: true,
      title: true,
      subject: true,
      grade: true,
      status: true,
      contentType: true,
      version: true,
      hash: true,
      payload: true,
      createdAt: true,
      updatedAt: true,
      moeAlignments: true,
    },
  });

  const thin = allContent.filter((c) => extractLessonText(c.payload).length < THIN_THRESHOLD);
  console.log(`Total CurriculumContent rows: ${allContent.length}`);
  console.log(`Thin rows (<${THIN_THRESHOLD} matchable chars): ${thin.length}`);

  const thinContentIds = thin.map((c) => c.contentId);

  const [scheduledWorkRows, assignmentRows] = await Promise.all([
    prisma.scheduledWork.findMany({
      where: { contentId: { in: thinContentIds } },
      select: { contentId: true },
    }),
    prisma.assignment.findMany({
      where: { contentId: { in: thinContentIds } },
      select: { contentId: true },
    }),
  ]);

  const attachedContentIds = new Set<string>();
  for (const r of scheduledWorkRows) attachedContentIds.add(r.contentId);
  for (const r of assignmentRows) if (r.contentId) attachedContentIds.add(r.contentId);

  console.log(`\nRe-verified fresh (not reused from earlier snapshot):`);
  console.log(`  Distinct thin lessons with >=1 ScheduledWork reference: ${new Set(scheduledWorkRows.map((r) => r.contentId)).size}`);
  console.log(`  Distinct thin lessons with >=1 Assignment reference: ${new Set(assignmentRows.map((r) => r.contentId)).size}`);
  console.log(`  Union (any real attachment): ${attachedContentIds.size}`);

  const unattached = thin.filter((c) => !attachedContentIds.has(c.contentId));
  const attached = thin.filter((c) => attachedContentIds.has(c.contentId));

  console.log(`\n=== PURGE CANDIDATE SET ===`);
  console.log(`  Unattached thin lessons (purge candidates): ${unattached.length}`);
  console.log(`  Attached thin lessons (regenerate-in-place candidates): ${attached.length}`);

  // Export full backup of the purge candidate set
  const archiveDir = resolve(process.cwd(), "archive");
  if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const exportPath = resolve(archiveDir, `thin-content-purge-export-${dateStamp}.json`);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    criteria: {
      thinThresholdChars: THIN_THRESHOLD,
      definition: "matchable text (title+description+objectives+content+summary+lessonPlan) < 300 chars AND zero ScheduledWork reference (via contentId) AND zero Assignment reference (via contentId)",
    },
    count: unattached.length,
    rows: unattached.map((c) => ({
      id: c.id,
      contentId: c.contentId,
      title: c.title,
      subject: c.subject,
      grade: c.grade,
      status: c.status,
      contentType: c.contentType,
      version: c.version,
      hash: c.hash,
      payload: c.payload,
      moeAlignments: c.moeAlignments,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };

  writeFileSync(exportPath, JSON.stringify(exportPayload, null, 2), "utf-8");
  const stats = require("node:fs").statSync(exportPath);
  console.log(`\nExport written: ${exportPath}`);
  console.log(`Export size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Rows in export: ${exportPayload.rows.length}`);

  // Also list attached-thin lessons (regenerate-in-place set) for completeness, no export needed (small)
  console.log(`\n=== REGENERATE-IN-PLACE SET (${attached.length} rows, not exported - not being deleted) ===`);
  for (const c of attached.slice(0, 20)) {
    console.log(`  ${c.contentId} (grade ${c.grade}, ${c.subject})`);
  }
  if (attached.length > 20) console.log(`  ... and ${attached.length - 20} more`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
