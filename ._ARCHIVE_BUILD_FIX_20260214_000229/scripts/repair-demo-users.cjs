const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function upsertUser(email, role, password, name) {
  const hashedPwd = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role,
      name,
      hashedPwd,
    },
    update: {
      role,
      name,
      hashedPwd,
    },
    select: { id: true, email: true, role: true, name: true, hashedPwd: true },
  });

  console.log("OK:", { email: user.email, role: user.role, hasHash: !!user.hashedPwd });
}

async function main() {
  const password = "password123";

  await upsertUser("student@school.lr", "STUDENT", password, "Demo Student");
  await upsertUser("teacher@school.lr", "TEACHER", password, "Demo Teacher");
  await upsertUser("admin@school.lr",   "ADMIN",   password, "Demo Admin");

  // Optional: ensure STUDENT has a Student profile row (only if your app expects it)
  const studentUser = await prisma.user.findUnique({ where: { email: "student@school.lr" }, select: { id: true } });
  if (studentUser) {
    await prisma.student.upsert({
      where: { userId: studentUser.id },
      create: { userId: studentUser.id, currentGrade: 4 },
      update: { currentGrade: 4 },
    });
    console.log("OK: Student profile ensured for student@school.lr");
  }
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
