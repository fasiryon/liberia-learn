// Schedule key hero lessons for demo student1@cha.edu.lr so they're accessible for VSL verification
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { prisma } from '@/lib/db';

async function main() {
  // Student1's class: cls-cha-math-0
  const classId = 'cls-cha-math-0';

  // Find the teacher for this class
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, teacherId: true, name: true },
  });
  if (!cls) { console.log('Class not found:', classId); await prisma.$disconnect(); return; }
  console.log('Class:', cls.name, '| teacherId:', cls.teacherId);

  // Today's date (UTC midnight)
  const today = new Date();
  const scheduledDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  console.log('Scheduling for:', scheduledDate.toISOString().slice(0,10));

  // Hero lessons to schedule (priority for VSL)
  const HERO_TO_SCHEDULE = [
    'hero-math-g5-understanding-fractions',
    'hero-math-g5-word-problems-multi-step-reasoning',
    'hero-math-g7-introduction-to-algebra-writing-and-solving-equations',
    'hero-science-g5-living-things-and-their-habitats',
    'hero-literacy-g7-essay-writing-structure-and-argumentation',
  ];

  for (const contentId of HERO_TO_SCHEDULE) {
    const content = await prisma.curriculumContent.findUnique({
      where: { contentId },
      select: { id: true, contentId: true, title: true },
    });
    if (!content) { console.log('Content not found:', contentId); continue; }

    // Check if already scheduled
    const existing = await prisma.scheduledWork.findFirst({
      where: { contentId: content.id, classId, scheduledDate },
    });
    if (existing) {
      console.log('Already scheduled:', contentId, '→ ScheduledWork:', existing.id);
      continue;
    }

    const sw = await prisma.scheduledWork.create({
      data: {
        contentId: content.contentId,
        classId,
        scheduledDate,
        createdById: cls.teacherId,
        status: 'confirmed',
      },
    });
    console.log('✓ Created ScheduledWork:', sw.id, '→', contentId);
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
