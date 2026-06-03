/**
 * Delete all hero-* CurriculumContent rows so generate-hero-lessons.ts can regenerate
 * them with the V2-fixed + gpt-4o + per-section enforcement pipeline.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/clear-hero-lessons.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/clear-hero-lessons.ts --dry-run
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { prisma } from '@/lib/db';
import { parseArgs } from 'node:util';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { 'dry-run': { type: 'boolean', default: false } },
    strict: false,
  });
  const dryRun = (values['dry-run'] as boolean) ?? false;

  const heroLessons = await prisma.curriculumContent.findMany({
    where: { contentId: { startsWith: 'hero-' } },
    select: { contentId: true },
  });

  console.log(`\nFound ${heroLessons.length} hero lesson(s) to delete.`);
  heroLessons.forEach((l) => console.log(' -', l.contentId));

  if (dryRun) {
    console.log('\n[dry-run] No changes made.');
    await prisma.$disconnect();
    return;
  }

  if (heroLessons.length === 0) {
    console.log('Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  const { count } = await prisma.curriculumContent.deleteMany({
    where: { contentId: { startsWith: 'hero-' } },
  });

  console.log(`\nDeleted ${count} hero lesson(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
