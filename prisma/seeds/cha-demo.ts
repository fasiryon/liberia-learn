// prisma/seeds/cha-demo.ts
// CHA High Academy demo accounts for MOE pilot demonstrations.
// Idempotent â€” safe to re-run. Uses upsert everywhere.
// Accounts match the official demo handout exactly.

import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Redis } from "@upstash/redis";
import { CHA_DEMO_SCHOOL_ID, CHA_DEMO_STUDENT_LOGIN_ID, chaDemoStudentEmail } from "../../lib/demo/chaStudentIdentity";

const prisma = new PrismaClient();

const LOCAL_DEMO_SEED_PASSWORD = "local-demo-password-change-me";
const DEMO_ADMIN_EMAIL = process.env.E2E_DEMO_ADMIN_EMAIL ?? ["admin", "cha.edu.lr"].join("@");
const DEMO_TEACHER_EMAIL = process.env.E2E_DEMO_TEACHER_EMAIL ?? ["teacher1", "cha.edu.lr"].join("@");
const DEMO_GUARDIAN_EMAIL = process.env.E2E_DEMO_GUARDIAN_EMAIL ?? ["guardian1", "cha.family.lr"].join("@");
const DEMO_MOE_EMAIL = process.env.E2E_DEMO_MOE_EMAIL ?? ["official1", "moe.gov.lr"].join("@");

function getDemoSeedPassword(): string {
  const password = process.env.DEMO_SEED_PASSWORD?.trim();
  if (password) return password;
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE === "true") {
    throw new Error("DEMO_SEED_PASSWORD is required for production/demo seed runs.");
  }
  return LOCAL_DEMO_SEED_PASSWORD;
}

function getMoeSeedPassword(): string {
  const password = process.env.DEMO_MOE_PASSWORD?.trim() || process.env.E2E_DEMO_MOE_PASSWORD?.trim();
  if (password) return password;
  throw new Error("DEMO_MOE_PASSWORD or E2E_DEMO_MOE_PASSWORD is required for CHA demo seed runs.");
}

const CHA_SCHOOL_ID = CHA_DEMO_SCHOOL_ID;
const CHA_CLASS_ID = "cha-class-grade9a";
const CHA_STUDENT_NAME = "Fatu Kollie";
const CHA_STUDENT_GRADE = 9;

type ChaDemoSeedOptions = { studentIdentityOnly?: boolean; studentUserIdentityOnly?: boolean };

class ChaDemoUserRepairError extends Error {}

function assertExclusiveModes(options: ChaDemoSeedOptions): void {
  if (options.studentIdentityOnly && options.studentUserIdentityOnly) {
    throw new Error("CHA student repair modes are mutually exclusive.");
  }
}

/** Explicit dispatch prevents a misspelled hosted repair flag from running the full seed. */
export function parseChaDemoSeedOptions(args: readonly string[]): ChaDemoSeedOptions {
  const options: ChaDemoSeedOptions = {};
  for (const arg of args) {
    if (arg === "--student-user-identity-only") options.studentUserIdentityOnly = true;
    else if (arg === "--student-identity-only") options.studentIdentityOnly = true;
    else throw new Error("Unknown CHA seed argument.");
  }
  assertExclusiveModes(options);
  return options;
}

/** Hosted repair: only User.update, never a student/placement/enrollment normalization. */
async function repairChaDemoUserIdentityOnly(): Promise<void> {
  const password = process.env.DEMO_SEED_PASSWORD?.trim();
  if (!password) throw new ChaDemoUserRepairError("DEMO_SEED_PASSWORD is required for User-only CHA repair.");
  const email = chaDemoStudentEmail();
  if (!email.trim()) throw new ChaDemoUserRepairError("An exact nonempty demo email is required for User-only CHA repair.");
  const demoHash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    const [school, user, loginOwner] = await Promise.all([
      tx.school.findUnique({ where: { id: CHA_DEMO_SCHOOL_ID }, select: { id: true, code: true } }),
      tx.user.findUnique({ where: { email }, select: { id: true } }),
      tx.user.findUnique({ where: { loginId: CHA_DEMO_STUDENT_LOGIN_ID }, select: { id: true } }),
    ]);
    if (school?.id !== CHA_DEMO_SCHOOL_ID || school.code !== "CHA") {
      throw new ChaDemoUserRepairError("User-only repair requires the existing canonical CHA school with code CHA.");
    }
    if (!user) throw new ChaDemoUserRepairError("User-only repair requires an existing demo User at the exact configured email.");
    const student = await tx.student.findUnique({ where: { userId: user.id }, select: { id: true, userId: true } });
    if (!student?.id || student.userId !== user.id) throw new ChaDemoUserRepairError("User-only repair requires the existing linked Student.");
    if (loginOwner && loginOwner.id !== user.id) throw new ChaDemoUserRepairError("The CHA demo login ID belongs to another User; repair refused.");
    // Serializable isolation plus User.loginId's existing UNIQUE constraint protects concurrent claims.
    // A collision/serialization failure is propagated; there is no retry, transfer or replacement User.
    await tx.user.update({
      where: { id: user.id },
      data: { email, loginId: CHA_DEMO_STUDENT_LOGIN_ID, name: CHA_STUDENT_NAME, role: "STUDENT",
        schoolId: CHA_DEMO_SCHOOL_ID, hashedPwd: demoHash, isPlatformAdmin: false },
    });
  }, { isolationLevel: "Serializable" });
  console.log("[cha-demo] Existing demo User identity repaired; learner history unchanged. Sign out and sign in again.");
}

/** Demo-only repair, anchored by exact configured email. Caller owns the transaction. */
async function repairChaStudent(tx: Prisma.TransactionClient, demoHash: string) {
  const email = chaDemoStudentEmail();
  const identity = {
    email, loginId: CHA_DEMO_STUDENT_LOGIN_ID, name: CHA_STUDENT_NAME,
    role: "STUDENT" as const, schoolId: CHA_DEMO_SCHOOL_ID, hashedPwd: demoHash,
    isPlatformAdmin: false,
  };
  const studentUser = await tx.user.upsert({ where: { email }, create: identity, update: identity });
  const studentRecord = await tx.student.upsert({
    where: { userId: studentUser.id },
    create: { userId: studentUser.id, currentGrade: CHA_STUDENT_GRADE },
    update: { currentGrade: CHA_STUDENT_GRADE },
  });
  // Latest placement is what the existing reports display. Preserve older history.
  const placement = await tx.placementTest.findFirst({
    where: { studentId: studentRecord.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { decision: true, reviews: { take: 1 } },
  });
  if (placement && (placement.sessionId || placement.source === "server_session" || placement.decision ||
    placement.reviews.length || placement.teacherDecision || placement.reviewedAt || placement.reviewedBy)) {
    throw new Error("CHA demo repair refuses a governed placement; review its existing authority separately.");
  }
  const placementData = {
    band: "G7_9", levelLabel: "Junior Secondary", estimatedGrade: CHA_STUDENT_GRADE,
    rawScore: 14, totalQuestions: 18, source: "seed:cha-demo",
    aiAnalysis: {
      summary: "Student demonstrates solid understanding of core mathematics concepts for Grade 9.",
      strengths: ["Algebra", "Number Theory"], gaps: ["Geometry proofs"],
    },
  };
  if (placement) {
    await tx.placementTest.update({
      where: { id: placement.id },
      data: { ...placementData, teacherGrade: null, teacherDecision: null, teacherReason: null,
        reviewedAt: null, reviewedBy: null, details: Prisma.JsonNull, questions: Prisma.JsonNull, answers: Prisma.JsonNull },
    });
  } else {
    await tx.placementTest.create({ data: { studentId: studentRecord.id, ...placementData } });
  }
  // Reset only this demo student's membership, removing obsolete/foreign class access.
  await tx.enrollment.deleteMany({ where: { studentId: studentRecord.id, classId: { not: CHA_CLASS_ID } } });
  await tx.enrollment.upsert({
    where: { studentId_classId: { studentId: studentRecord.id, classId: CHA_CLASS_ID } },
    create: { studentId: studentRecord.id, classId: CHA_CLASS_ID }, update: {},
  });
  return { studentUser, studentRecord };
}

export async function seedChaDemo(options: ChaDemoSeedOptions = {}) {
  assertExclusiveModes(options);
  if (options.studentUserIdentityOnly) {
    await repairChaDemoUserIdentityOnly();
    return;
  }
  if (options.studentIdentityOnly) {
    const demoHash = await bcrypt.hash(getDemoSeedPassword(), 10);
    await prisma.$transaction(async (tx) => {
      const [school, cls, existing] = await Promise.all([
        tx.school.findUnique({ where: { id: CHA_DEMO_SCHOOL_ID }, select: { id: true, code: true } }),
        tx.class.findUnique({ where: { id: CHA_CLASS_ID }, select: { id: true, schoolId: true } }),
        tx.user.findUnique({ where: { email: chaDemoStudentEmail() }, select: { id: true } }),
      ]);
      if (!existing) throw new Error("CHA repair requires an existing demo account at the exact configured email.");
      if (school?.code !== "CHA" || cls?.schoolId !== CHA_DEMO_SCHOOL_ID) throw new Error("CHA repair requires the existing canonical CHA school and Grade 9A class.");
      await repairChaStudent(tx, demoHash);
    }, { isolationLevel: "Serializable" });
    console.log("[cha-demo] Existing demo student identity repaired; sign out and sign in again.");
    return;
  }
  console.log("[cha-demo] Seeding CHA demo accounts...");
  const demoPass = getDemoSeedPassword();
  const moePass = getMoeSeedPassword();

  const [demoHash, moeHash] = await Promise.all([
    bcrypt.hash(demoPass, 10),
    bcrypt.hash(moePass, 10),
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
  if (school.id !== CHA_DEMO_SCHOOL_ID) throw new Error("CHA school code resolves to a noncanonical school ID; repair requires review.");

  // â”€â”€ Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    create: {
      email: DEMO_ADMIN_EMAIL,
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
    where: { email: DEMO_TEACHER_EMAIL },
    create: {
      email: DEMO_TEACHER_EMAIL,
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
    update: { teacherId: teacher.id, schoolId: school.id },
  });

  // â”€â”€ Student â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { studentUser, studentRecord } = await prisma.$transaction(
    (tx) => repairChaStudent(tx, demoHash), { isolationLevel: "Serializable" },
  );

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

  // â”€â”€ Guardian â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const guardian = await prisma.user.upsert({
    where: { email: DEMO_GUARDIAN_EMAIL },
    create: {
      email: DEMO_GUARDIAN_EMAIL,
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
    where: { email: DEMO_MOE_EMAIL },
    create: {
      email: DEMO_MOE_EMAIL,
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
  console.log("  E2E_DEMO_ADMIN_EMAIL       / DEMO_SEED_PASSWORD (ADMIN)");
  console.log("  E2E_DEMO_TEACHER_EMAIL     / DEMO_SEED_PASSWORD (TEACHER)");
  console.log("  E2E_DEMO_STUDENT_EMAIL     / DEMO_SEED_PASSWORD (STUDENT)");
  console.log("  E2E_DEMO_GUARDIAN_EMAIL    / DEMO_SEED_PASSWORD (GUARDIAN)");
  console.log("  E2E_DEMO_MOE_EMAIL         / DEMO_MOE_PASSWORD (MOE_OFFICIAL)");
  console.log("  platform.admin@liberialearn.org / DEMO_SEED_PASSWORD (PLATFORM ADMIN)");
}

// Direct run
if (require.main === module) {
  Promise.resolve().then(() => seedChaDemo(parseChaDemoSeedOptions(process.argv.slice(2))))
    .catch((e) => {
      if (process.argv.includes("--student-user-identity-only")) {
        // Never print query arguments, password hashes or connection details from a hosted failure.
        console.error(e instanceof ChaDemoUserRepairError ? e.message : "[cha-demo] User-only repair failed; no history normalization attempted.");
        if (typeof e?.code === "string" && /^P\d{4}$/.test(e.code)) console.error(`[cha-demo] Database error code: ${e.code}`);
      } else console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
