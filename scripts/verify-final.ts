// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const certCompleted = await prisma.certificate.count({ where: { status: "completed", canvaUrl: { not: null } } });
  const certPending = await prisma.certificate.count({ where: { status: "pending" } });
  const certFailed = await prisma.certificate.count({ where: { status: "failed" } });
  const certTotal = await prisma.certificate.count();

  console.log("--- CERTIFICATES ---");
  console.log("Total:", certTotal);
  console.log("Completed (canvaUrl set):", certCompleted);
  console.log("Pending:", certPending);
  console.log("Failed:", certFailed);

  const cards = await prisma.generatedDocument.groupBy({
    by: ["status"],
    where: { type: "STUDENT_ID_CARD" },
    _count: true,
  });
  const cardTotal = await prisma.generatedDocument.count({ where: { type: "STUDENT_ID_CARD" } });

  console.log("--- ID CARDS ---");
  console.log("Total GeneratedDocument records:", cardTotal);
  console.log("By status:", JSON.stringify(cards));
}

main()
  .catch((e) => { console.error("Fatal:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
