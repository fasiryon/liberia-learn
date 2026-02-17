import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Log which DB we're targeting (redact password)
const dbUrl = process.env.DATABASE_URL || '';
const redacted = dbUrl.replace(/:([^@]+)@/, ':***@');
console.log('Using DATABASE_URL:', redacted);

const emails = [
  "admin@school.lr",
  "teacher@school.lr",
  "student@school.lr",
  "admin@mcs.edu.lr",
  "teacher@mcs.edu.lr",
  "guardian@mcs.edu.lr"
];

const newPassword = "Password123";

async function main(){
  const hash = await bcrypt.hash(newPassword, 12);

  let updated = 0;
  let missing = 0;

  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log("MISSING", email);
      missing++;
      continue;
    }

    await prisma.user.update({
      where: { email },
      data: { hashedPwd: hash }
    });

    console.log("UPDATED", email, "role=", user.role);
    updated++;
  }

  console.log({ ok: true, updated, missing });
}

main()
  .catch(e => {
    console.error("FAIL:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma["$disconnect"]();
  });
