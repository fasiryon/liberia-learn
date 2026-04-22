// prisma/seeds/cha-demo.ts
// CHA High Academy demo accounts for MOE pilot demonstrations.
// Idempotent â€” safe to re-run. Uses upsert everywhere.
// Accounts match the official demo handout exactly.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASS = "DemoSeed2026!";
const MOE_PASS = "MOESeed2026!";

const CHA_SCHOOL_ID = "cha-high-academy";
const CHA_CLASS_ID = "cha-class-grade9a";

export async function seedChaDemo() {
  console.log("[cha-demo] Seeding CHA demo accounts...");

  const [demoHash, moeHash] = await Promise.all([
    bcrypt.hash(DEMO_PASS, 10),
    bcrypt.hash(MOE_PASS, 10),
  ]);

  // â”€â”€ School â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const school = await prisma.school.upsert({
    where: { code: "CHA" },
    create: {
      id: CHA_SCHOOL_ID,
      name: "Cha High Academy",
      county: "Montserrado",
      code: "CHA",
    },
    update: {},
  });

  // â”€â”€ Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const admin = await prisma.user.upsert({
    where: { email: "admin@cha.edu.lr" },
    create: {
      email: "admin@cha.edu.lr",
      name: "CHA Administrator",
      role: "ADMIN",
      hashedPwd: demoHash,
      schoolId: school.id,
      isPlatformAdmin: false,
    },
    update: { hashedPwd: demoHash },
  });

  // â”€â”€ Teacher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const teacher = await prisma.user.upsert({
    where: { email: "teacher1@cha.edu.lr" },
    create: {
      email: "teacher1@cha.edu.lr",
      name: "Mary Pewee",
      role: "TEACHER",
      hashedPwd: demoHash,
      schoolId: school.id,
    },
    update: { hashedPwd: demoHash },
  });

  // Teacher profile (upsert by userId)
  await prisma.teacherProfile.upsert({
    where: { userId: teacher.id },
    create: {
      id: `tp_cha_teacher`,
      userId: teacher.id,
      schoolId: school.id,
      fullName: "Mary Pewee",
      permissions: {
        active: true,
        subjectSpecialty: "Mathematics",
        allowPublish: false,
        allowBlueprint: false,
      },
      gradesTaught: ["G7_9"],
      subjectsTaught: ["MATH"],
      isOnboarded: true,
      updatedAt: new Date(),
    },
    update: {},
  }).catch(() => {
    // Profile may already exist â€” skip
  });

  // â”€â”€ Class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cls = await prisma.class.upsert({
    where: { id: CHA_CLASS_ID },
    create: {
      id: CHA_CLASS_ID,
      name: "Grade 9A â€” Mathematics",
      subject: "MATH",
      schoolId: school.id,
      teacherId: teacher.id,
    },
    update: { teacherId: teacher.id },
  });

  // â”€â”€ Student â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const studentUser = await prisma.user.upsert({
    where: { email: "student1@cha.edu.lr" },
    create: {
      email: "student1@cha.edu.lr",
      loginId: "CHA-2026-0001",
      name: "Fatu Kollie",
      role: "STUDENT",
      hashedPwd: demoHash,
      schoolId: school.id,
    },
    update: { hashedPwd: demoHash },
  });

  let studentRecord = await prisma.student.findUnique({
    where: { userId: studentUser.id },
  });
  if (!studentRecord) {
    studentRecord = await prisma.student.create({
      data: { userId: studentUser.id, currentGrade: 9 },
    });
  }

  // Enrollment (skip if already enrolled)
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: studentRecord.id, classId: cls.id },
  });
  if (!existingEnrollment) {
    await prisma.enrollment.create({
      data: { studentId: studentRecord.id, classId: cls.id },
    });
  }

  const seededLessonContentId = "cha-g9-math-multimedia-demo";
  const seededScheduledWorkId = "cha-demo-student1-multimedia-lesson";
  const seededLessonPayload = {
    title: "Ratios in Market Prices",
    durationMins: 45,
    objectives: [
      "Explain a ratio as a comparison between two quantities.",
      "Use equivalent ratios to compare market prices.",
      "Solve a real-world price problem using a ratio table.",
    ],
    body: `Ratios help us compare quantities in everyday life. In a market, a buyer may compare the price of rice, cassava, or notebooks by asking how much one unit costs compared with another.

## What a Ratio Means

A ratio compares two quantities. If 2 notebooks cost 100 Liberian dollars, the ratio of notebooks to dollars is 2 to 100. We can write that as 2:100.

Ratios can be simplified when both numbers can be divided by the same amount. The ratio 2:100 can be divided by 2 to become 1:50. That means one notebook costs 50 Liberian dollars.

## Using Equivalent Ratios

Equivalent ratios describe the same relationship using different numbers. If 1 notebook costs 50 Liberian dollars, then 3 notebooks cost 150 Liberian dollars and 5 notebooks cost 250 Liberian dollars.

A ratio table helps us organize this pattern. Each row keeps the same relationship between the number of notebooks and the total cost.

## Market Price Example

A vendor sells 4 oranges for 80 Liberian dollars. To find the cost of 1 orange, divide both parts of the ratio by 4. The ratio 4:80 becomes 1:20, so one orange costs 20 Liberian dollars.

To find the cost of 7 oranges, multiply 1:20 by 7. The result is 7:140, so 7 oranges cost 140 Liberian dollars.

## Key Takeaways

- A ratio compares two quantities.
- Equivalent ratios keep the same relationship.
- Ratio tables help solve market price problems step by step.`,
    body_standard: `Ratios help us compare quantities in everyday life. In a market, a buyer may compare the price of rice, cassava, or notebooks by asking how much one unit costs compared with another.

## What a Ratio Means

A ratio compares two quantities. If 2 notebooks cost 100 Liberian dollars, the ratio of notebooks to dollars is 2 to 100. We can write that as 2:100.

Ratios can be simplified when both numbers can be divided by the same amount. The ratio 2:100 can be divided by 2 to become 1:50. That means one notebook costs 50 Liberian dollars.

## Using Equivalent Ratios

Equivalent ratios describe the same relationship using different numbers. If 1 notebook costs 50 Liberian dollars, then 3 notebooks cost 150 Liberian dollars and 5 notebooks cost 250 Liberian dollars.

A ratio table helps us organize this pattern. Each row keeps the same relationship between the number of notebooks and the total cost.

## Market Price Example

A vendor sells 4 oranges for 80 Liberian dollars. To find the cost of 1 orange, divide both parts of the ratio by 4. The ratio 4:80 becomes 1:20, so one orange costs 20 Liberian dollars.

To find the cost of 7 oranges, multiply 1:20 by 7. The result is 7:140, so 7 oranges cost 140 Liberian dollars.

## Key Takeaways

- A ratio compares two quantities.
- Equivalent ratios keep the same relationship.
- Ratio tables help solve market price problems step by step.`,
  };
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  await prisma.curriculumContent.upsert({
    where: { contentId: seededLessonContentId },
    update: {
      title: "Ratios in Market Prices",
      grade: 9,
      subject: "MATH",
      contentType: "lesson",
      status: "APPROVED",
      version: "multimedia-demo-v1",
      payload: seededLessonPayload,
    },
    create: {
      contentId: seededLessonContentId,
      title: "Ratios in Market Prices",
      grade: 9,
      subject: "MATH",
      contentType: "lesson",
      status: "APPROVED",
      version: "multimedia-demo-v1",
      payload: seededLessonPayload,
    },
  });
  await prisma.scheduledWork.upsert({
    where: { id: seededScheduledWorkId },
    update: {
      contentId: seededLessonContentId,
      classId: cls.id,
      scheduledDate: todayUtc,
      periodNumber: 1,
      startTime: "08:00",
      endTime: "08:45",
      createdById: teacher.id,
      classFormat: "standard",
      status: "confirmed",
    },
    create: {
      id: seededScheduledWorkId,
      contentId: seededLessonContentId,
      classId: cls.id,
      scheduledDate: todayUtc,
      periodNumber: 1,
      startTime: "08:00",
      endTime: "08:45",
      createdById: teacher.id,
      classFormat: "standard",
      status: "confirmed",
    },
  });

  // Placement test
  const existingPlacement = await prisma.placementTest.findFirst({
    where: { studentId: studentRecord.id },
  });
  if (!existingPlacement) {
    await prisma.placementTest.create({
      data: {
        studentId: studentRecord.id,
        band: "G7_9",
        levelLabel: "Junior Secondary",
        estimatedGrade: 9,
        rawScore: 14,
        totalQuestions: 18,
        aiAnalysis: {
          summary:
            "Student demonstrates solid understanding of core mathematics concepts for Grade 9.",
          strengths: ["Algebra", "Number Theory"],
          gaps: ["Geometry proofs"],
        },
      },
    });
    await prisma.student.update({
      where: { id: studentRecord.id },
      data: { currentGrade: 9 },
    });
  }

  // â”€â”€ Guardian â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const guardian = await prisma.user.upsert({
    where: { email: "guardian1@cha.family.lr" },
    create: {
      email: "guardian1@cha.family.lr",
      name: "Emmanuel Kollie",
      role: "GUARDIAN",
      hashedPwd: demoHash,
      schoolId: school.id,
      guardianPhone: "0771000001",
      guardianPhoneE164: "+2310771000001",
      preferredChannel: "SMS",
    },
    update: { hashedPwd: demoHash },
  });

  // Guardian-student link
  const existingLink = await prisma.studentGuardian.findFirst({
    where: { studentId: studentRecord.id, guardianId: guardian.id },
  });
  if (!existingLink) {
    await prisma.studentGuardian.create({
      data: {
        studentId: studentRecord.id,
        guardianId: guardian.id,
        relation: "Parent",
      },
    });
  }

  // â”€â”€ MOE Official â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.user.upsert({
    where: { email: "official1@moe.gov.lr" },
    create: {
      email: "official1@moe.gov.lr",
      name: "MOE Inspector General",
      role: "MOE_OFFICIAL",
      hashedPwd: moeHash,
      schoolId: null,
      isPlatformAdmin: false,
    },
    update: { hashedPwd: moeHash },
  });

  console.log("[cha-demo] Done. Accounts created:");
  console.log("  admin@cha.edu.lr           / DemoSeed2026! (ADMIN)");
  console.log("  teacher1@cha.edu.lr        / DemoSeed2026! (TEACHER)");
  console.log("  student1@cha.edu.lr        / DemoSeed2026! (STUDENT)");
  console.log("  guardian1@cha.family.lr    / DemoSeed2026! (GUARDIAN)");
  console.log("  official1@moe.gov.lr       / MOESeed2026!  (MOE_OFFICIAL)");
}

// Direct run
if (require.main === module) {
  seedChaDemo()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
