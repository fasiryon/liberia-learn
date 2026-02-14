import { PrismaClient, MasteryMeasurementType, EvidenceSourceType } from "@prisma/client";
import { recordMasteryFromGrade, getMasteryTrajectory } from "../src/lib/grading/mastery";

const prisma = new PrismaClient();

async function main() {
  // CHANGE THESE IDs to real ones from your DB
  const studentId = process.env.DEMO_STUDENT_ID!;
  const skillId = process.env.DEMO_SKILL_ID!;
  const gradeId = process.env.DEMO_GRADE_ID!;

  if (!studentId || !skillId || !gradeId) {
    throw new Error("Set DEMO_STUDENT_ID, DEMO_SKILL_ID, DEMO_GRADE_ID in .env before running.");
  }

  await recordMasteryFromGrade({
    studentId,
    skillId,
    gradeId,
    percent: 75,
    measurementType: MasteryMeasurementType.FORMATIVE,
    sourceType: EvidenceSourceType.ASSESSMENT,
    contextNote: "Demo mastery snapshot from a quiz grade",
  });

  const trajectory = await getMasteryTrajectory({ studentId, skillId });
  console.log("Trajectory:", trajectory.map(t => ({ measuredAt: t.measuredAt, mastery: t.masteryLevel, evidenceCount: t.evidence.length })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
