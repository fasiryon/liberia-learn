/**
 * Generate 20 hero demo lessons using generateLessonV2 and upsert them into CurriculumContent.
 *
 * These are high-quality, deeply engaging demo lessons covering key topics across
 * MATH, SCIENCE, LITERACY, SOCIAL_STUDIES, and COMPUTER_SCIENCE for grades 2-10.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-hero-lessons.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-hero-lessons.ts --dry-run
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-hero-lessons.ts --limit 5
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-hero-lessons.ts --start 5 --limit 10
 *
 * Requires env vars: DATABASE_URL (or DIRECT_URL), OPENAI_API_KEY.
 * Each lesson takes ~30-60 seconds to generate. Total estimated time: ~15-20 minutes.
 */

// Ensure DATABASE_URL is set from DIRECT_URL if needed
if (process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { prisma } from '@/lib/db';
import { createConservativeCurriculumMaintenanceClient } from '@/lib/curriculum/mutations/maintenanceClient';
const governedCurriculum = createConservativeCurriculumMaintenanceClient('generate-hero-lessons');
import { generateLessonV2, GenerateLessonV2Error } from '@/lib/curriculum/generateLessonV2';
import { createHash } from 'crypto';
import { parseArgs } from 'node:util';

// â”€â”€â”€ Hero lessons catalog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const HERO_LESSONS = [
  // â”€â”€ WAVE-1A originals (indices 0-19) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { grade: 2, subject: 'MATH', topic: 'Place Value: Tens and Ones' },
  { grade: 2, subject: 'MATH', topic: 'Addition with Two-Digit Numbers' },
  { grade: 5, subject: 'MATH', topic: 'Understanding Fractions' },
  { grade: 5, subject: 'MATH', topic: 'Multiplication: Area Model and Standard Algorithm' },
  { grade: 5, subject: 'MATH', topic: 'Word Problems: Multi-Step Reasoning' },
  { grade: 7, subject: 'MATH', topic: 'Introduction to Algebra: Writing and Solving Equations' },
  { grade: 7, subject: 'MATH', topic: 'Geometry: Area and Perimeter of Polygons' },
  { grade: 9, subject: 'MATH', topic: 'Quadratic Equations: Factoring and the Quadratic Formula' },
  { grade: 5, subject: 'SCIENCE', topic: 'Living Things and Their Habitats' },
  { grade: 5, subject: 'SCIENCE', topic: 'Forces and Motion' },
  { grade: 7, subject: 'SCIENCE', topic: 'Ecosystems: Food Chains and Biodiversity' },
  { grade: 7, subject: 'SCIENCE', topic: 'Weather Systems and Climate in West Africa' },
  { grade: 10, subject: 'SCIENCE', topic: 'Chemistry Basics: Atoms, Elements, and Compounds' },
  { grade: 2, subject: 'LITERACY', topic: 'Reading Comprehension: Main Idea and Details' },
  { grade: 7, subject: 'LITERACY', topic: 'Essay Writing: Structure and Argumentation' },
  { grade: 10, subject: 'LITERACY', topic: 'Persuasive Essays: Evidence and Rhetorical Devices' },
  { grade: 5, subject: 'SOCIAL_STUDIES', topic: 'Liberian Geography: Counties and Natural Resources' },
  { grade: 9, subject: 'SOCIAL_STUDIES', topic: 'Liberian History: Independence and the Modern State' },
  { grade: 6, subject: 'COMPUTER_SCIENCE', topic: 'Introduction to Python Programming' },
  { grade: 9, subject: 'COMPUTER_SCIENCE', topic: 'AI Literacy: How Machine Learning Works' },

  // â”€â”€ WAVE-1B: Hard gaps â€” demo blockers (indices 20-24) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { grade: 5, subject: 'CIVICS', topic: 'Rights and Responsibilities in a Liberian Community' },
  { grade: 7, subject: 'CIVICS', topic: 'Democracy and Representation in Liberia' },
  { grade: 9, subject: 'CIVICS', topic: 'Branches of Government and Checks and Balances' },
  { grade: 5, subject: 'ENGLISH', topic: 'Grammar Foundations: Parts of Speech with Liberian Stories' },
  { grade: 7, subject: 'ENGLISH', topic: 'Vocabulary in Context: Reading West African Texts' },

  // â”€â”€ WAVE-1B: Soft gaps â€” demo-path subjects (indices 25-29) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { grade: 5, subject: 'LITERACY', topic: 'Narrative Writing: Personal Stories with Liberian Settings' },
  { grade: 7, subject: 'SOCIAL_STUDIES', topic: 'African Geography and Culture: West Africa in Focus' },
  { grade: 6, subject: 'MATH', topic: 'Ratios and Proportions: Real-World Applications' },
  { grade: 6, subject: 'SCIENCE', topic: 'The Human Body Systems' },
  { grade: 2, subject: 'SCIENCE', topic: 'Living Things and Their Needs' },

  // â”€â”€ WAVE-1C: ENGINEERING heroes for CHA demo timetable (indices 30-34) â”€â”€
  { grade: 5, subject: 'ENGINEERING', topic: 'Simple Machines: Levers, Pulleys and Inclined Planes in Liberia' },
  { grade: 7, subject: 'ENGINEERING', topic: 'Structural Design: Building Bridges with Local Materials' },
  { grade: 7, subject: 'ENGINEERING', topic: 'Water Systems Engineering: Clean Water Solutions for Communities' },
  { grade: 9, subject: 'ENGINEERING', topic: 'Renewable Energy: Solar and Hydro Power for Rural Liberia' },
  { grade: 5, subject: 'ENGINEERING', topic: 'Problem-Solving with the Engineering Design Process' },

  // â”€â”€ WAVE-1C patch: second LITERACY G7 hero so P2 and P6 show distinct lessons (index 35) â”€â”€
  { grade: 7, subject: 'LITERACY', topic: 'Poetry and Figurative Language in West African Voices' },
];

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeContentId(grade: number, subject: string, topic: string): string {
  const slug = `${subject.toLowerCase()}-g${grade}-${topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;
  return `hero-${slug}`;
}

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean', default: false },
      'limit': { type: 'string' },
      'start': { type: 'string' },
    },
    strict: false,
  });

  const dryRun = (values['dry-run'] as boolean) ?? false;
  const limit = values['limit'] ? parseInt(values['limit'] as string, 10) : HERO_LESSONS.length;
  const start = values['start'] ? parseInt(values['start'] as string, 10) : 0;

  const batch = HERO_LESSONS.slice(start, start + limit);
  console.log(
    `\n[hero-gen] Starting. dryRun=${dryRun}, lessons=${batch.length} (${start}..${start + batch.length - 1})\n`
  );

  let generated = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const lesson = batch[i];
    const contentId = makeContentId(lesson.grade, lesson.subject, lesson.topic);
    console.log(`\n[${i + 1}/${batch.length}] Generating: ${contentId}`);
    console.log(`  Grade ${lesson.grade} ${lesson.subject}: "${lesson.topic}"`);

    if (dryRun) {
      console.log(`  [dry-run] Would generate and upsert ${contentId}`);
      generated++;
      continue;
    }

    try {
      const result = await generateLessonV2({
        grade: lesson.grade,
        subject: lesson.subject,
        topic: lesson.topic,
        demoReady: true,
        model: 'gpt-4o',
      });

      const { payload } = result;
      const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
      const payloadJson = payload as any;

      await governedCurriculum.upsert({
        where: { contentId },
        create: {
          contentId,
          title: payload.title,
          grade: lesson.grade,
          subject: lesson.subject,
          contentType: 'lesson',
          status: 'published',
          version: '2.0.0',
          hash,
          payload: payloadJson,
          lessonType: 'core',
          isHero: true,
        },
        update: {
          title: payload.title,
          status: 'published',
          version: '2.0.0',
          hash,
          payload: payloadJson,
          isHero: true,
        },
      });

      console.log(
        `  âœ“ Saved: "${payload.title}" (${result.wordCount} words, ${result.problemSetsCount} problems, ${result.slidesCount} slides, model: ${result.model})`
      );
      generated++;
    } catch (error) {
      const msg = error instanceof GenerateLessonV2Error ? error.message : String(error);
      console.error(`  âœ— Failed: ${msg}`);
      failed++;
    }

    // Rate limit gap between lessons
    if (i < batch.length - 1) {
      console.log('  Waiting 5s before next lesson...');
      await sleep(5000);
    }
  }

  console.log(`\n[hero-gen] Complete. Generated: ${generated}, Failed: ${failed}\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[hero-gen] Fatal error:', err);
  process.exit(1);
});
