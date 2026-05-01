// prisma/seeds/cha-demo.ts
// CHA High Academy demo accounts for MOE pilot demonstrations.
// Idempotent â€” safe to re-run. Uses upsert everywhere.
// Accounts match the official demo handout exactly.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Redis } from "@upstash/redis";

const prisma = new PrismaClient();

const LOCAL_DEMO_SEED_PASSWORD = "local-demo-password-change-me";
const MOE_PASS = "MOESeed2026!";

function getDemoSeedPassword(): string {
  const password = process.env.DEMO_SEED_PASSWORD?.trim();
  if (password) return password;
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE === "true") {
    throw new Error("DEMO_SEED_PASSWORD is required for production/demo seed runs.");
  }
  return LOCAL_DEMO_SEED_PASSWORD;
}

const CHA_SCHOOL_ID = "cha-high-academy";
const CHA_CLASS_ID = "cha-class-grade9a";

export async function seedChaDemo() {
  console.log("[cha-demo] Seeding CHA demo accounts...");
  const demoPass = getDemoSeedPassword();

  const [demoHash, moeHash] = await Promise.all([
    bcrypt.hash(demoPass, 10),
    bcrypt.hash(MOE_PASS, 10),
  ]);
  const platformHash = await bcrypt.hash(demoPass, 10);

  // â”€â”€ School â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const school = await prisma.school.upsert({
    where: { code: "CHA" },
    create: {
      id: CHA_SCHOOL_ID,
      name: "Cha High Academy",
      county: "Montserrado",
      district: "Montserrado",
      code: "CHA",
    },
    update: { district: "Montserrado" },
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

  const demoExam = await prisma.exam.upsert({
    where: { id: "cha-demo-ratios-exam" },
    update: {
      title: "Ratios in Market Prices Check",
      subject: "MATH",
      grade: 9,
      schoolId: school.id,
      classId: cls.id,
      createdBy: teacher.id,
      status: "PUBLISHED",
      moeStandards: ["MATH.G9.RATIO"],
      timeLimit: 20,
      passingScore: 0.7,
      publishedAt: new Date(),
    },
    create: {
      id: "cha-demo-ratios-exam",
      title: "Ratios in Market Prices Check",
      subject: "MATH",
      grade: 9,
      schoolId: school.id,
      classId: cls.id,
      createdBy: teacher.id,
      status: "PUBLISHED",
      moeStandards: ["MATH.G9.RATIO"],
      timeLimit: 20,
      passingScore: 0.7,
      publishedAt: new Date(),
    },
  });
  await prisma.examQuestion.deleteMany({ where: { examId: demoExam.id } });
  await prisma.examQuestion.createMany({
    data: [
      {
        examId: demoExam.id,
        prompt: "If 4 oranges cost 80 Liberian dollars, what is the cost of 1 orange?",
        options: ["20 Liberian dollars", "40 Liberian dollars", "80 Liberian dollars", "160 Liberian dollars"],
        correctIndex: 0,
        explanation: "Divide both values by 4. The ratio 4:80 becomes 1:20.",
        moeCode: "MATH.G9.RATIO",
      },
      {
        examId: demoExam.id,
        prompt: "Which ratio is equivalent to 2:100?",
        options: ["1:50", "1:100", "2:50", "4:100"],
        correctIndex: 0,
        explanation: "Both 2 and 100 can be divided by 2 to make 1:50.",
        moeCode: "MATH.G9.RATIO",
      },
    ],
  });
  await prisma.certificate.upsert({
    where: {
      studentId_type_referenceId: {
        studentId: studentRecord.id,
        type: "LESSON",
        referenceId: seededScheduledWorkId,
      },
    },
    update: {},
    create: {
      studentId: studentRecord.id,
      type: "LESSON",
      referenceId: seededScheduledWorkId,
      certificateCode: "CHA4P5A1",
    },
  });
  await prisma.learningEvent.deleteMany({ where: { source: "seed:cha-demo" } });
  await prisma.learningEvent.createMany({
    data: [
      { schoolId: school.id, classId: cls.id, userId: studentUser.id, studentId: studentRecord.id, eventType: "LESSON_MODE_CHANGED", source: "seed:cha-demo", contentId: seededLessonContentId, lessonId: seededScheduledWorkId, metadata: { mode: "read" } },
      { schoolId: school.id, classId: cls.id, userId: studentUser.id, studentId: studentRecord.id, eventType: "LESSON_MODE_CHANGED", source: "seed:cha-demo", contentId: seededLessonContentId, lessonId: seededScheduledWorkId, metadata: { mode: "slides" } },
      { schoolId: school.id, classId: cls.id, userId: studentUser.id, studentId: studentRecord.id, eventType: "LESSON_MODE_CHANGED", source: "seed:cha-demo", contentId: seededLessonContentId, lessonId: seededScheduledWorkId, metadata: { mode: "listen" } },
      { schoolId: school.id, classId: cls.id, userId: studentUser.id, studentId: studentRecord.id, eventType: "AUDIO_PLAYBACK_STARTED", source: "seed:cha-demo", contentId: seededLessonContentId, lessonId: seededScheduledWorkId, metadata: { seeded: true } },
      { schoolId: school.id, classId: cls.id, userId: studentUser.id, studentId: studentRecord.id, eventType: "VIDEO_PLAYBACK_STARTED", source: "seed:cha-demo", contentId: seededLessonContentId, lessonId: seededScheduledWorkId, metadata: { seeded: true } },
    ],
  });

  // Recent assessment attempts — needed for MOE dashboard 30-day window
  await prisma.assessmentAttempt.deleteMany({ where: { source: "seed:cha-demo" } });
  await prisma.assessmentAttempt.createMany({
    data: [
      {
        studentId: studentRecord.id,
        schoolId: school.id,
        subject: "MATH",
        grade: 9,
        score: 0.78,
        status: "completed",
        source: "seed:cha-demo",
        attemptedAt: new Date(),
      },
      {
        studentId: studentRecord.id,
        schoolId: school.id,
        subject: "MATH",
        grade: 9,
        score: 0.65,
        status: "completed",
        source: "seed:cha-demo",
        attemptedAt: new Date(),
      },
    ],
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

  await prisma.user.upsert({
    where: { email: "platform.admin@liberialearn.org" },
    create: {
      email: "platform.admin@liberialearn.org",
      name: "LiberiaLearn Platform Admin",
      role: "ADMIN",
      hashedPwd: platformHash,
      schoolId: null,
      isPlatformAdmin: true,
    },
    update: { hashedPwd: platformHash, isPlatformAdmin: true, schoolId: null },
  });

  // Invalidate MOE dashboard Redis cache so re-seeded district data shows immediately
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (redisUrl && redisToken) {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const now = new Date();
      const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      await redis.del(`moe:dashboard:national:v2:${month}`);
      console.log("[cha-demo] Redis cache invalidated.");
    }
  } catch {
    // Best-effort — cache will expire naturally in 15 minutes
  }

  console.log("[cha-demo] Done. Accounts created:");
  console.log("  admin@cha.edu.lr           / DEMO_SEED_PASSWORD (ADMIN)");
  console.log("  teacher1@cha.edu.lr        / DEMO_SEED_PASSWORD (TEACHER)");
  console.log("  student1@cha.edu.lr        / DEMO_SEED_PASSWORD (STUDENT)");
  console.log("  guardian1@cha.family.lr    / DEMO_SEED_PASSWORD (GUARDIAN)");
  console.log("  official1@moe.gov.lr       / MOESeed2026!  (MOE_OFFICIAL)");
  console.log("  platform.admin@liberialearn.org / DEMO_SEED_PASSWORD (PLATFORM ADMIN)");
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
