// prisma/seeds/cha-demo.ts
// CHA High Academy demo accounts for MOE pilot demonstrations.
// Idempotent — safe to re-run. Uses upsert everywhere.
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

  // ── School ──────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where: { id: CHA_SCHOOL_ID },
    create: {
      id: CHA_SCHOOL_ID,
      name: "Cha High Academy",
      county: "Montserrado",
      code: "CHA",
    },
    update: {},
  });

  // ── Admin ────────────────────────────────────────────────
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

  // ── Teacher ──────────────────────────────────────────────
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
    // Profile may already exist — skip
  });

  // ── Class ────────────────────────────────────────────────
  const cls = await prisma.class.upsert({
    where: { id: CHA_CLASS_ID },
    create: {
      id: CHA_CLASS_ID,
      name: "Grade 9A — Mathematics",
      subject: "MATH",
      schoolId: school.id,
      teacherId: teacher.id,
    },
    update: { teacherId: teacher.id },
  });

  // ── Student ──────────────────────────────────────────────
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

  // ── Guardian ─────────────────────────────────────────────
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

  // ── MOE Official ─────────────────────────────────────────
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
