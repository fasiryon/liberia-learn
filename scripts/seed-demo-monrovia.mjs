/**
 * Idempotent seed script for demo-school-monrovia tenant.
 * Creates: 1 class, enrollments, 1 homework, 1 submission.
 * Usage: node scripts/seed-demo-monrovia.mjs
 * Requires .env.local (loaded via dotenv).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Log which DB we're targeting (redact password)
const dbUrl = process.env.DATABASE_URL || "";
const redacted = dbUrl.replace(/:([^@]+)@/, ":***@");
console.log("DB:", redacted);

async function main() {
  // 1. Find the demo school
  const school = await prisma.school.findFirst({
    where: { name: { contains: "Monrovia Consolidated" } },
  });
  if (!school) {
    console.error("ERROR: No school matching 'Monrovia Consolidated' found. Run onboarding first.");
    process.exit(1);
  }
  console.log("School:", school.id, school.name);

  // 2. Find teacher
  const teacher = await prisma.user.findUnique({
    where: { email: "teacher@mcs.edu.lr" },
  });
  if (!teacher) {
    console.error("ERROR: teacher@mcs.edu.lr not found.");
    process.exit(1);
  }
  console.log("Teacher:", teacher.id, teacher.email);

  // 3. Find students in this school
  const studentUsers = await prisma.user.findMany({
    where: { schoolId: school.id, role: "STUDENT" },
    take: 5,
  });
  console.log("Students found:", studentUsers.length);

  // 4. Upsert class: "Grade 4 Mathematics"
  let cls = await prisma.class.findFirst({
    where: { schoolId: school.id, name: "Grade 4 Mathematics" },
  });
  if (!cls) {
    cls = await prisma.class.create({
      data: {
        schoolId: school.id,
        name: "Grade 4 Mathematics",
        subject: "MATH",
        teacherId: teacher.id,
      },
    });
    console.log("Created class:", cls.id);
  } else {
    // Ensure teacher is assigned
    if (cls.teacherId !== teacher.id) {
      await prisma.class.update({
        where: { id: cls.id },
        data: { teacherId: teacher.id },
      });
    }
    console.log("Class exists:", cls.id);
  }

  // 5. Ensure student profiles exist and enroll them
  for (const su of studentUsers) {
    // Ensure Student record exists
    let student = await prisma.student.findUnique({
      where: { userId: su.id },
    });
    if (!student) {
      student = await prisma.student.create({
        data: {
          userId: su.id,
          county: "Montserrado",
          community: "Monrovia",
          currentGrade: 4,
        },
      });
      console.log("Created student profile:", student.id, su.email);
    }

    // Enroll in class (upsert via unique constraint)
    const existing = await prisma.enrollment.findFirst({
      where: { studentId: student.id, classId: cls.id },
    });
    if (!existing) {
      await prisma.enrollment.create({
        data: { studentId: student.id, classId: cls.id },
      });
      console.log("Enrolled", su.email, "in", cls.name);
    }
  }

  // 6. Create homework if none exists
  let hw = await prisma.homework.findFirst({
    where: { classId: cls.id },
  });
  if (!hw) {
    hw = await prisma.homework.create({
      data: {
        classId: cls.id,
        title: "Addition and Subtraction Practice",
        description: "Complete 10 addition and subtraction problems. Show your work.",
        createdById: teacher.id,
        instructions: "Solve each problem step by step. Write your final answer clearly.",
        questions: JSON.parse(JSON.stringify([
          { question: "What is 245 + 378?", type: "FR" },
          { question: "What is 500 - 167?", type: "FR" },
          { question: "A market woman has 456 Liberian dollars. She spends 189. How much is left?", type: "FR" },
        ])),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("Created homework:", hw.id, hw.title);
  } else {
    console.log("Homework exists:", hw.id, hw.title);
  }

  // 7. Create one submission (from first student) if none exists
  if (studentUsers.length > 0) {
    const firstStudent = await prisma.student.findUnique({
      where: { userId: studentUsers[0].id },
    });
    if (firstStudent) {
      const existingSub = await prisma.homeworkSubmission.findFirst({
        where: { homeworkId: hw.id, studentId: firstStudent.id },
      });
      if (!existingSub) {
        await prisma.homeworkSubmission.create({
          data: {
            homeworkId: hw.id,
            studentId: firstStudent.id,
            answers: JSON.parse(JSON.stringify([
              { questionIndex: 0, answer: "623" },
              { questionIndex: 1, answer: "333" },
              { questionIndex: 2, answer: "267" },
            ])),
            aiScore: 85,
            aiFeedback: JSON.parse(JSON.stringify({
              overall: "Good work! 2 out of 3 correct.",
              perQuestion: ["Correct!", "Correct!", "Close, the answer is 267 LD."],
            })),
            aiReviewed: true,
          },
        });
        console.log("Created submission for", studentUsers[0].email);
      } else {
        console.log("Submission already exists");
      }
    }
  }

  console.log("\nSeed complete! Summary:");
  console.log("  School:", school.name);
  console.log("  Class:", cls.name, "(", cls.id, ")");
  console.log("  Students enrolled:", studentUsers.length);
  console.log("  Homework:", hw.title);
}

main()
  .catch((e) => {
    console.error("SEED FAILED:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
