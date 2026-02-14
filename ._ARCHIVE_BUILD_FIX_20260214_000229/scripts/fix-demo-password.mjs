import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.argv[2] ?? "student@school.lr";
const password = process.argv[3] ?? "password123";

const hash = await bcrypt.hash(password, 10);

const existing = await prisma.user.findUnique({ where: { email } });

if (!existing) {
  // Create minimal user. Adjust fields if your schema requires more.
  await prisma.user.create({
    data: {
      email,
      name: "Demo Student",
      role: "STUDENT",
      hashedPwd: hash
    }
  });
  console.log("✅ Created user + set bcrypt password:", email);
} else {
  await prisma.user.update({
    where: { email },
    data: { hashedPwd: hash }
  });
  console.log("✅ Updated bcrypt password for:", email);
}

await prisma.$disconnect();
