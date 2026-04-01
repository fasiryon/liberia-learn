// prisma/seeds/demo-school.ts
// Comprehensive demo school seed for MOE pilot demos.
// Safe to re-run — uses upsert everywhere.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SCHOOL_ID = "demo-school-monrovia";
const CLASS_ID = "demo-class-grade5";
const PASSWORD = "DemoSeed2026!";

const STUDENT_DATA = [
  { email: "student1@mcs.edu.lr", name: "James Doe" },
  { email: "student2@mcs.edu.lr", name: "Mary Johnson" },
  { email: "student3@mcs.edu.lr", name: "Emmanuel Kollie" },
  { email: "student4@mcs.edu.lr", name: "Comfort Sumo" },
  { email: "student5@mcs.edu.lr", name: "Abraham Flomo" },
];

async function main() {
  console.log("Seeding demo school: Monrovia Central School...");

  const hashed = await bcrypt.hash(PASSWORD, 12);

  // ── School ──────────────────────────────────────────────────
  await prisma.school.upsert({
    where: { id: SCHOOL_ID },
    update: { name: "Monrovia Central School", code: "MCS", primaryHex: "#22c55e", secondaryHex: "#0ea5e9" },
    create: {
      id: SCHOOL_ID,
      name: "Monrovia Central School",
      code: "MCS",
      timezone: "Africa/Monrovia",
      primaryHex: "#22c55e",
      secondaryHex: "#0ea5e9",
    },
  });
  console.log("  School upserted");

  // ── Admin ───────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "admin@mcs.edu.lr" },
    update: { hashedPwd: hashed, schoolId: SCHOOL_ID },
    create: {
      email: "admin@mcs.edu.lr",
      name: "Principal Kollie",
      role: "ADMIN",
      hashedPwd: hashed,
      schoolId: SCHOOL_ID,
    },
  });
  console.log("  Admin upserted");

  // ── Teacher ─────────────────────────────────────────────────
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@mcs.edu.lr" },
    update: { hashedPwd: hashed, schoolId: SCHOOL_ID },
    create: {
      email: "teacher@mcs.edu.lr",
      name: "Mrs. Pewee",
      role: "TEACHER",
      hashedPwd: hashed,
      schoolId: SCHOOL_ID,
    },
  });
  console.log("  Teacher upserted");

  // ── Students ────────────────────────────────────────────────
  const studentUserIds: string[] = [];

  for (const s of STUDENT_DATA) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { hashedPwd: hashed, schoolId: SCHOOL_ID },
      create: {
        email: s.email,
        name: s.name,
        role: "STUDENT",
        hashedPwd: hashed,
        schoolId: SCHOOL_ID,
      },
    });
    studentUserIds.push(user.id);

    // Student profile
    await prisma.student.upsert({
      where: { userId: user.id },
      update: { currentGrade: 5 },
      create: { userId: user.id, currentGrade: 5 },
    });
  }
  console.log(`  ${STUDENT_DATA.length} students upserted`);

  // ── Guardian ────────────────────────────────────────────────
  const guardian = await prisma.user.upsert({
    where: { email: "guardian@mcs.edu.lr" },
    update: { hashedPwd: hashed, schoolId: SCHOOL_ID },
    create: {
      email: "guardian@mcs.edu.lr",
      name: "Mr. Doe",
      role: "GUARDIAN",
      hashedPwd: hashed,
      schoolId: SCHOOL_ID,
    },
  });

  // Link guardian to student1
  const student1 = await prisma.student.findUnique({
    where: { userId: studentUserIds[0] },
  });
  if (student1) {
    await prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: {
          studentId: student1.id,
          guardianId: guardian.id,
        },
      },
      update: { relation: "Father" },
      create: {
        studentId: student1.id,
        guardianId: guardian.id,
        relation: "Father",
      },
    });
  }
  console.log("  Guardian upserted + linked to student1");

  // ── Class ───────────────────────────────────────────────────
  // Class.subject is enum Subject — using MATH for Grade 5A
  await prisma.class.upsert({
    where: { id: CLASS_ID },
    update: { teacherId: teacher.id },
    create: {
      id: CLASS_ID,
      name: "Grade 5A",
      schoolId: SCHOOL_ID,
      teacherId: teacher.id,
      subject: "MATH",
    },
  });
  console.log("  Class upserted");

  // ── Enrollments ─────────────────────────────────────────────
  const allStudents = await prisma.student.findMany({
    where: { userId: { in: studentUserIds } },
  });

  for (const stu of allStudents) {
    await prisma.enrollment.upsert({
      where: {
        studentId_classId: { studentId: stu.id, classId: CLASS_ID },
      },
      update: {},
      create: { studentId: stu.id, classId: CLASS_ID },
    });
  }
  console.log(`  ${allStudents.length} enrollments upserted`);

  // ── Homework ────────────────────────────────────────────────
  const now = Date.now();

  // Homework 1 — Fractions Practice
  await prisma.homework.upsert({
    where: { id: "demo-hw-fractions" },
    update: {},
    create: {
      id: "demo-hw-fractions",
      classId: CLASS_ID,
      title: "Fractions Practice",
      description: "Practice adding and comparing simple fractions.",
      instructions: "Answer each question. Show your work where possible.",
      createdById: teacher.id,
      dueAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
      questions: [
        { text: "What is 1/2 + 1/4? Show your steps." },
        { text: "Which is larger: 3/5 or 2/3? Explain how you know." },
        { text: "A market woman sells 1/3 of her rice in the morning and 1/4 in the afternoon. What fraction did she sell in total?" },
      ],
    },
  });

  // Homework 2 — Reading Comprehension
  await prisma.homework.upsert({
    where: { id: "demo-hw-reading" },
    update: {},
    create: {
      id: "demo-hw-reading",
      classId: CLASS_ID,
      title: "Reading Comprehension",
      description: "Read the passage and answer the questions.",
      instructions: "Read carefully. Answer in complete sentences.",
      createdById: teacher.id,
      dueAt: new Date(now + 5 * 24 * 60 * 60 * 1000),
      questions: [
        { text: "Read the passage about the St. Paul River. What is the main idea?" },
        { text: "List two ways people along the river use the water." },
        { text: "Why is the rainy season both helpful and dangerous for river communities?" },
      ],
    },
  });
  console.log("  2 homework assignments upserted");

  // ── Placement Tests ─────────────────────────────────────────
  const student1Record = allStudents.find((s) => s.userId === studentUserIds[0]);
  const student2Record = allStudents.find((s) => s.userId === studentUserIds[1]);

  for (const stu of [student1Record, student2Record]) {
    if (!stu) continue;
    // Use create (no unique constraint for upsert) — check if exists first
    const existing = await prisma.placementTest.findFirst({
      where: { studentId: stu.id, band: "G4_6", estimatedGrade: 5 },
    });
    if (!existing) {
      await prisma.placementTest.create({
        data: {
          studentId: stu.id,
          band: "G4_6",
          estimatedGrade: 5,
          levelLabel: "Elementary",
          rawScore: 7,
          totalQuestions: 9,
        },
      });
    }
  }
  console.log("  Placement tests created for student1 & student2");

  // ── Audit Logs (14 days of activity) ────────────────────────
  const actions = ["lesson_view", "homework_submit", "tutor_message"];
  let auditCount = 0;

  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const hoursOffset = Math.floor(Math.random() * 10) + 8; // 8am-6pm
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    createdAt.setHours(hoursOffset, Math.floor(Math.random() * 60), 0, 0);

    const userId = studentUserIds[i % studentUserIds.length];
    const action = actions[i % actions.length];

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: { source: "demo-seed", contentId: `demo-content-${i}` },
        createdAt,
      },
    });
    auditCount++;
  }
  console.log(`  ${auditCount} audit log events created`);

  console.log("\nDemo school seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
