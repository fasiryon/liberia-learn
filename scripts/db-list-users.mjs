import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, schoolId: true, name: true },
    orderBy: { email: "asc" },
    take: 50,
  });

  console.log("Found users:", users.length);
  for (const u of users) {
    console.log(`${u.role}\t${u.email}\t${u.id}\tschool=${u.schoolId ?? "null"}\t${u.name ?? ""}`);
  }
}

main()
  .catch((e) => {
    console.error("FAIL:", e?.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
