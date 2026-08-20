/**
 * Reclassifies all CurriculumContent lessons with subject="PE" to correct subjects.
 *
 * Rules:
 *   - APPROVED G1-G9 genuine PE topics â†’ SOCIAL_STUDIES
 *   - G7/G8 non-APPROVED with literacy-skill titles â†’ LITERACY
 *   - G7/G8 non-APPROVED with physical-PE titles â†’ SOCIAL_STUDIES
 *
 * Run with --dry-run to preview changes without writing.
 */

import { PrismaClient } from '@prisma/client';
import { createConservativeCurriculumMaintenanceClient } from '@/lib/curriculum/mutations/maintenanceClient';
const governedCurriculum = createConservativeCurriculumMaintenanceClient('reclassify-pe-lessons');

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

// Keywords that indicate a lesson is teaching literacy skills using sports as context.
// Case-insensitive substring match on title.
const LITERACY_MARKERS = [
  'verb',
  'tense',
  'vocab',
  'synonym',
  'antonym',
  'adjective',
  'adverb',
  'sentence',
  'oral',
  'listen',
  'context clue',
  'opinion',
  'character',
  'setting',
  'detail',
  'summari',
  'infer',
  'narrative',
  'story',
  'stories',
  'comprehension',
  'word',        // "new words", "words in sports", "choosing words"
  'question',   // "asking and answering questions"
  'conversation', // "respectful conversations"
  'discuss',    // "class discussions"
  'descriptive language',
  'explain',
  'express',
  'present',
  'communication',
  'speaking',
  'reading',
  'writing',
  'describing',
  'text',
  'view',       // "sharing views with reasons"
  'punctuation',
  'dialogue',
  'quote',
  'grammar',
  'paragraph',
  'clause',
  'spelling',
  'fluency',
  'language skill',
  'language use',
  'main idea',
  'key idea',
  'topic sentence',
  'explanat',    // "explanation/explanations" (â‰  "explain" substring)
  'retell',
  'narrat',
];

function classifyMixed(title: string): 'LITERACY' | 'SOCIAL_STUDIES' {
  const lower = (title ?? '').toLowerCase();
  if (LITERACY_MARKERS.some(m => lower.includes(m))) return 'LITERACY';
  return 'SOCIAL_STUDIES';
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  const all = await prisma.curriculumContent.findMany({
    where: { subject: 'PE' },
    select: { id: true, grade: true, title: true, status: true },
    orderBy: [{ grade: 'asc' }, { status: 'asc' }],
  });

  console.log(`Found ${all.length} PE lessons to reclassify.\n`);

  const toSocialStudies: string[] = [];
  const toLiteracy: string[] = [];

  for (const lesson of all) {
    const isApproved = lesson.status === 'APPROVED';
    const isG7orG8 = lesson.grade === 7 || lesson.grade === 8;

    if (isApproved || !isG7orG8) {
      // All APPROVED (any grade) and all non-G7/G8 â†’ genuine PE â†’ SOCIAL_STUDIES
      toSocialStudies.push(lesson.id);
    } else {
      // G7/G8 non-APPROVED: keyword-based split
      const target = classifyMixed(lesson.title ?? '');
      if (target === 'LITERACY') {
        toLiteracy.push(lesson.id);
      } else {
        toSocialStudies.push(lesson.id);
      }
    }
  }

  console.log(`â†’ SOCIAL_STUDIES: ${toSocialStudies.length}`);
  console.log(`â†’ LITERACY: ${toLiteracy.length}`);

  // Print sample of LITERACY classifications for sanity check
  const literacySample = all
    .filter(l => toLiteracy.includes(l.id))
    .slice(0, 15);
  console.log('\nSample LITERACY reclassifications:');
  for (const l of literacySample) {
    console.log(`  [G${l.grade}][${l.status}] ${l.title}`);
  }

  const ssSample = all
    .filter(l => toSocialStudies.includes(l.id) && (l.grade === 7 || l.grade === 8) && l.status !== 'APPROVED')
    .slice(0, 10);
  console.log('\nSample SOCIAL_STUDIES reclassifications (G7/G8 non-APPROVED only):');
  for (const l of ssSample) {
    console.log(`  [G${l.grade}][${l.status}] ${l.title}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run complete â€” no changes written.');
    return;
  }

  console.log('\nWriting changes...');

  const BATCH = 100;

  // Reclassify â†’ SOCIAL_STUDIES
  let ssUpdated = 0;
  for (let i = 0; i < toSocialStudies.length; i += BATCH) {
    const batch = toSocialStudies.slice(i, i + BATCH);
    const res = await governedCurriculum.updateMany({
      where: { id: { in: batch } },
      data: { subject: 'SOCIAL_STUDIES' },
    });
    ssUpdated += res.count;
    process.stdout.write(`  SOCIAL_STUDIES: ${ssUpdated}/${toSocialStudies.length}\r`);
  }
  console.log(`\n  SOCIAL_STUDIES done: ${ssUpdated} updated`);

  // Reclassify â†’ LITERACY
  let litUpdated = 0;
  for (let i = 0; i < toLiteracy.length; i += BATCH) {
    const batch = toLiteracy.slice(i, i + BATCH);
    const res = await governedCurriculum.updateMany({
      where: { id: { in: batch } },
      data: { subject: 'LITERACY' },
    });
    litUpdated += res.count;
    process.stdout.write(`  LITERACY: ${litUpdated}/${toLiteracy.length}\r`);
  }
  console.log(`\n  LITERACY done: ${litUpdated} updated`);

  console.log(`\nTotal updated: ${ssUpdated + litUpdated} / ${all.length}`);

  // Verify
  const remaining = await prisma.curriculumContent.count({ where: { subject: 'PE' } });
  console.log(`PE lessons remaining after reclassification: ${remaining}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
