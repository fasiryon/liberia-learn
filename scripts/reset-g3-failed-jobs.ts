// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.curriculumRegenerationJob.updateMany({
    where: { status: "FAILED", gradeLevel: { lte: 3 } },
    data: { status: "PENDING", attempt: 0 },
  });
  console.log(`Reset ${result.count} G1-G3 FAILED jobs to PENDING`);

  const pending = await prisma.curriculumRegenerationJob.count({
    where: { status: "PENDING", gradeLevel: { lte: 3 } },
  });
  console.log(`G1-G3 PENDING jobs now: ${pending}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
