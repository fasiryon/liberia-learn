import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function seedCoreStandards() {
  // Math G7 example (WASSCE-aligned progression later)
  const std = await prisma.standard.upsert({
    where: { code: 'MATH.G7.LINEAR.1' },
    update: {},
    create: {
      code: 'MATH.G7.LINEAR.1',
      description: 'Solve single-variable linear equations with rational coefficients.',
      subject: 'MATH',
      band: 'G7_9',
    },
  });

  const skill = await prisma.skill.upsert({
    where: { id: 'seed-skill-g7-linear' },
    update: {},
    create: {
      id: 'seed-skill-g7-linear',
      subject: 'MATH',
      band: 'G7_9',
      descriptor: 'Solve ax + b = c; translate word problems into equations.',
      examples: [{ worked: '2x + 3 = 11 → x = 4' }],
      standards: { connect: [{ id: std.id }] },
    },
  });

  await prisma.practiceItem.upsert({
    where: { id: 'seed-item-g7-001' },
    update: {},
    create: {
      id: 'seed-item-g7-001',
      skillId: skill.id,
      stimulus: 'Solve: 3x - 5 = 13',
      itemType: 'MCQ',
      difficulty: 'D2',
      answerKey: { correct: '6', options: ['4', '5', '6', '7'] },
      hints: ['Add 5 → 3x=18', 'Divide by 3 → x=6'],
    },
  });
}

export async function seedBlockTemplates() {
  await prisma.blockScheduleTemplate.upsert({
    where: { id: 'tmpl-a-day-g9-12' },
    update: {},
    create: {
      id: 'tmpl-a-day-g9-12',
      name: 'A-Day',
      level: 'G9-12',
      slots: [
        { start: '08:00', end: '09:30', subject: 'MATH' },
        { start: '09:40', end: '11:10', subject: 'SCIENCE' },
        { start: '11:40', end: '13:10', subject: 'COMPUTER_SCIENCE' },
        { start: '13:20', end: '14:50', subject: 'ENGINEERING' },
      ],
    } as any,
  });
}

export async function seedWAECSubjects() {
  const tags = [
    { code: 'ENG.WASSCE', subject: 'LITERACY', desc: 'English Language (WAEC/WASSCE)' },
    { code: 'MATH.WASSCE', subject: 'MATH', desc: 'Mathematics (WAEC/WASSCE)' },
    { code: 'BIO.WASSCE', subject: 'SCIENCE', desc: 'Biology (WASSCE)' },
    { code: 'CHEM.WASSCE', subject: 'SCIENCE', desc: 'Chemistry (WASSCE)' },
    { code: 'PHYS.WASSCE', subject: 'SCIENCE', desc: 'Physics (WASSCE)' },
    { code: 'ECON.WASSCE', subject: 'CAREER', desc: 'Economics (WASSCE)' },
    { code: 'GOVT.WASSCE', subject: 'CIVICS', desc: 'Government (WASSCE)' },
    { code: 'LIT.WASSCE', subject: 'LITERACY', desc: 'Literature in English (WASSCE)' },
    { code: 'ICT.WASSCE', subject: 'COMPUTER_SCIENCE', desc: 'ICT/Computer Studies (WASSCE)' },
  ];
  for (const t of tags) {
    await prisma.standard.upsert({
      where: { code: t.code },
      update: {},
      create: {
        code: t.code,
        description: t.desc,
        subject: t.subject as any,
        band: 'G10_12',
      },
    });
  }
}

if (require.main === module) {
  (async () => {
    await seedCoreStandards();
    await seedBlockTemplates();
    await seedWAECSubjects();
    console.log('✅ Curriculum seed done.');
    await prisma.$disconnect();
  })();
}
