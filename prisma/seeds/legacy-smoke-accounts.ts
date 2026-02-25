import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SCHOOL_ID = "demo-school-monrovia";
const PASSWORD = "Password123";

async function main() {
  console.log("Seeding legacy smoke-test accounts into:", SCHOOL_ID);

  const school = await prisma.school.findUnique({ where: { id: SCHOOL_ID } });
  if (!school) {
    throw new Error(`Missing school ${SCHOOL_ID}. Run prisma/seeds/demo-school.ts first.`);
  }

  const hashed = await bcrypt.hash(PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: "admin@school.lr" },
    update: { hashedPwd: hashed, role: "ADMIN", schoolId: SCHOOL_ID },
    create: {
      email: "admin@school.lr",
      name: "Legacy Admin",
      role: "ADMIN",
      hashedPwd: hashed,
      schoolId: SCHOOL_ID,
    },
  });

  await prisma.user.upsert({
    where: { email: "teacher@school.lr" },
    update: { hashedPwd: hashed, role: "TEACHER", schoolId: SCHOOL_ID },
    create: {
      email: "teacher@school.lr",
      name: "Legacy Teacher",
      role: "TEACHER",
      hashedPwd: hashed,
      schoolId: SCHOOL_ID,
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@school.lr" },
    update: { hashedPwd: hashed, role: "STUDENT", schoolId: SCHOOL_ID },
    create: {
      email: "student@school.lr",
      name: "Legacy Student",
      role: "STUDENT",
      hashedPwd: hashed,
      schoolId: SCHOOL_ID,
    },
  });

  // Ensure Student profile exists for student flows
  await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: { currentGrade: 5, county: "Montserrado", community: "Monrovia" },
    create: { userId: studentUser.id, currentGrade: 5, county: "Montserrado", community: "Monrovia" },
  });

  console.log("✅ Legacy accounts upserted: admin@school.lr, teacher@school.lr, student@school.lr");
}

main()
  .catch((e) => {
    console.error("FAIL:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
