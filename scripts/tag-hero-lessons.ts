/**
 * scripts/tag-hero-lessons.ts
 *
 * WAVE-1A: Tag all hero-* CurriculumContent records as isHero=true.
 * Excludes the thin G10 Persuasive lesson (saved only 2,006 words — not demo-ready).
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/tag-hero-lessons.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/tag-hero-lessons.ts --dry-run
 */

if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";

const prisma = new PrismaClient();

// Thin lesson excluded from demo routing
const THIN_CONTENT_ID = "hero-literacy-g10-persuasive-essays-evidence-and-rhetorical-devices";

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { "dry-run": { type: "boolean", default: false } },
    strict: false,
  });
  const dryRun = (values["dry-run"] as boolean) ?? false;

  // Inspect current state
  const all = await prisma.curriculumContent.findMany({
    where: { contentId: { startsWith: "hero-" } },
    select: { id: true, contentId: true, isHero: true, status: true, payload: true },
    orderBy: { contentId: "asc" },
  });

  console.log(`\n▶ WAVE-1A tag-hero-lessons  dryRun=${dryRun}`);
  console.log(`  Total hero-* records found: ${all.length}`);
  console.log();

  const toTag = all.filter(r => r.contentId !== THIN_CONTENT_ID && !r.isHero);
  const alreadyTagged = all.filter(r => r.contentId !== THIN_CONTENT_ID && r.isHero);
  const thin = all.filter(r => r.contentId === THIN_CONTENT_ID);

  for (const r of all) {
    const p = r.payload as Record<string, unknown>;
    const body = typeof p.body === "string" ? p.body : (typeof p.body_standard === "string" ? p.body_standard : "");
    const wc = body.trim().split(/\s+/).filter(Boolean).length;
    const flag = r.contentId === THIN_CONTENT_ID ? "⊘ THIN-EXCLUDED" : r.isHero ? "✓ already tagged" : "→ will tag";
    console.log(`  ${flag.padEnd(20)} ${r.contentId.slice(0, 60).padEnd(62)} ${wc}w  status:${r.status}`);
  }

  console.log();
  console.log(`  Will tag:       ${toTag.length}`);
  console.log(`  Already tagged: ${alreadyTagged.length}`);
  console.log(`  Thin/excluded:  ${thin.length}`);

  if (dryRun) {
    console.log("\n  [dry-run] No changes made.");
    return;
  }

  if (toTag.length === 0) {
    console.log("\n✅ All hero lessons already tagged — nothing to do.");
    return;
  }

  const result = await prisma.curriculumContent.updateMany({
    where: {
      contentId: { startsWith: "hero-" },
      NOT: { contentId: THIN_CONTENT_ID },
    },
    data: { isHero: true },
  });

  console.log(`\n✅ Tagged ${result.count} hero lesson(s) with isHero=true.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
