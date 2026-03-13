// prisma/seeds/placement-test.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEMENT_TEST_ID = "placement-test-demo-g4-6";

async function main() {
  // Find the demo student (seeded by prisma/seed.ts)
  const user = await prisma.user.findUnique({
    where: { email: "student@school.lr" },
    include: { student: true },
  });

  if (!user?.student) {
    throw new Error(
      "Demo student not found. Run `npx prisma db seed` first to create the demo student."
    );
  }

  const studentId = user.student.id;

  // Grab the seeded placement items for the G4_6 band to store as questions/answers
  const items = await prisma.practiceItem.findMany({
    where: { Skill: { band: "G4_6" } },
    include: { Skill: true },
  });

  const questions = items.map((item) => ({
    practiceItemId: item.id,
    stimulus: item.stimulus,
    itemType: item.itemType,
    subject: item.Skill.subject,
  }));

  const answers = items.map((item) => ({
    practiceItemId: item.id,
    response: (item.answerKey as any)?.correct ?? "",
    correct: true,
  }));

  const result = await prisma.placementTest.upsert({
    where: { id: PLACEMENT_TEST_ID },
    update: {
      rawScore: answers.length,
      totalQuestions: questions.length,
      questions,
      answers,
    },
    create: {
      id: PLACEMENT_TEST_ID,
      student: { connect: { id: studentId } },
      band: "proficient",
      levelLabel: "Proficient",
      estimatedGrade: 5,
      rawScore: answers.length,
      totalQuestions: questions.length,
      questions,
      answers,
      details: { source: "seed", note: "Demo placement test for G4-6 band" },
    },
  });

  console.log(
    `Upserted PlacementTest "${result.id}" — band=${result.band}, ` +
      `score=${result.rawScore}/${result.totalQuestions}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
