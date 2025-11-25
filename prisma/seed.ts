// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding LiberiaLearn data...");

  // Dev-only reset – wipe in safe order
  await prisma.homeworkSubmission.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.class.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.student.deleteMany();
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();

  // Shared demo password for all seeded accounts
  const plainPassword = "password123";
  const hashed = await bcrypt.hash(plainPassword, 10);

  // --- Users --------------------------------------------------------
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@liberialearn.lr",
      name: "LiberiaLearn Admin",
      role: "ADMIN",
      hashedPwd: hashed,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: "teacher@school.lr",
      name: "Sample Teacher",
      role: "TEACHER",
      hashedPwd: hashed,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: "student@school.lr",
      name: "Sample Student",
      role: "STUDENT",
      hashedPwd: hashed,
    },
  });

  // --- Student profile ----------------------------------------------
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      county: "Montserrado",
      community: "New Kru Town",
    },
  });

  // --- Schools ------------------------------------------------------
  const schools = await Promise.all(
    [
      "New Kru Town Community School",
      "Monrovia Consolidated School System",
      "St. Patrick's High School",
      "United Methodist University",
      "Nimba County Community College",
      "G. W. Gibson High School",
      "Tubman University",
      "Booker Washington Institute",
    ].map((name) =>
      prisma.school.create({
        data: { name },
      })
    )
  );

  const newKruTown = schools[0];

  // --- Classes ------------------------------------------------------
  // subject is enum Subject; we'll use SCIENCE for both demo classes
  const mathClass = await prisma.class.create({
    data: {
      name: "Grade 6 Mathematics",
      subject: "SCIENCE",
      teacherId: teacherUser.id,
      schoolId: newKruTown.id,
    },
  });

  const mcssScience = await prisma.class.create({
    data: {
      name: "Grade 7 Science",
      subject: "SCIENCE",
      teacherId: teacherUser.id,
      schoolId: schools[1].id, // Monrovia Consolidated School System
    },
  });
  
  const scienceClass = await prisma.class.create({
    data: {
      name: "Grade 6 Science",
      subject: "SCIENCE",
      teacherId: teacherUser.id,
      schoolId: newKruTown.id,
    },
  });

  // --- Enrollments --------------------------------------------------
  await prisma.enrollment.create({
    data: {
      studentId: student.id,
      classId: mathClass.id,
    },
  });

  await prisma.enrollment.create({
    data: {
      studentId: student.id,
      classId: scienceClass.id,
    },
  });

  // --- Homework -----------------------------------------------------
  const now = Date.now();
  const inThreeDays = new Date(now + 3 * 24 * 60 * 60 * 1000);
  const inFiveDays = new Date(now + 5 * 24 * 60 * 60 * 1000);

  const mathHomework1 = await prisma.homework.create({
    data: {
      title: "Fractions Basics",
      instructions:
        "Answer all questions. Show your work clearly where possible.",
      questions: [
        { text: "Explain what a fraction is in your own words." },
        { text: "Solve: 1/2 + 1/4. Show your steps." },
        { text: "Give 3 real-life examples where fractions are used." },
      ],
      classId: mathClass.id,
      dueAt: inThreeDays,
    },
  });

  const mathHomework2 = await prisma.homework.create({
    data: {
      title: "Multiplication Practice",
      instructions:
        "Solve all problems carefully. Double-check your answers.",
      questions: [
        { text: "12 × 8 =" },
        { text: "15 × 6 =" },
        {
          text:
            "A farmer has 9 baskets with 6 oranges each. How many oranges in total?",
        },
      ],
      classId: mathClass.id,
      dueAt: inFiveDays,
    },
  });

  await prisma.homework.create({
    data: {
      title: "Living and Non-living Things",
      instructions:
        "Explain the difference between living and non-living things and give examples.",
      questions: [
        { text: "Define a living thing and give 3 examples." },
        { text: "Define a non-living thing and give 3 examples." },
        { text: "Why is water important for living things?" },
      ],
      classId: scienceClass.id,
      dueAt: inFiveDays,
    },
  });

  // --- Example submission (already graded) --------------------------
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: mathHomework1.id,
      studentId: student.id,
      answers: [
        "A fraction represents a part of a whole, written as a numerator over a denominator.",
        "1/2 + 1/4 = 2/4 + 1/4 = 3/4.",
        "Sharing food, measuring ingredients, splitting time in activities.",
      ],
      submittedAt: new Date(),
      teacherScore: 85,
      teacherNotes:
        "Good understanding. Work on explaining steps more clearly.",
    },
  });

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
