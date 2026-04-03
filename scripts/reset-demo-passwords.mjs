import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const updates = [
  { email: "admin@cha.edu.lr", password: "DemoSeed2026!" },
  { email: "teacher1@cha.edu.lr", password: "DemoSeed2026!" },
  { email: "student1@cha.edu.lr", password: "DemoSeed2026!" },
  { email: "guardian1@cha.family.lr", password: "DemoSeed2026!" },
  { email: "official1@moe.gov.lr", password: "MOESeed2026!" },
];

async function main() {
  let updated = 0;
  let missing = 0;

  for (const entry of updates) {
    const user = await prisma.user.findUnique({ where: { email: entry.email } });
    if (!user) {
      console.log("MISSING", entry.email);
      missing++;
      continue;
    }

    await prisma.user.update({
      where: { email: entry.email },
      data: { hashedPwd: await bcrypt.hash(entry.password, 12) },
    });
    console.log("UPDATED", entry.email, "role=", user.role);
    updated++;
  }

  console.log({ ok: true, updated, missing });
}

main()
  .catch((e) => {
    console.error("FAIL:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
