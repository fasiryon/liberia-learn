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
  const lessons = await prisma.curriculumContent.findMany({
    where: { status: "APPROVED", updatedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { contentId: true, title: true, grade: true, subject: true, status: true, updatedAt: true, payload: true },
  });

  if (lessons.length === 0) {
    console.log("No lessons approved in the last 6 hours.");
    await prisma.$disconnect();
    return;
  }

  for (const l of lessons) {
    const p = l.payload as Record<string, unknown>;
    const bodyBlock = typeof p?.body_block === "string" ? p.body_block : "";
    const bodyStd = typeof p?.body_standard === "string" ? p.body_standard : "";
    const lessonContent = typeof p?.lessonContent === "string" ? p.lessonContent : "";
    const richContent = lessonContent || bodyBlock || bodyStd || (typeof p?.body === "string" ? p.body : "") || "";
    const wordCount = richContent.trim().split(/\s+/).filter(Boolean).length;
    const slideCount = (richContent.match(/^##\s+/gm) ?? []).length;
    const gen = p?.generationMetadata as Record<string, unknown> | undefined;
    const approvalStatus = p?.approvalStatus;

    console.log("─".repeat(60));
    console.log(`Title    : ${l.title}`);
    console.log(`Grade    : ${l.grade}  Subject: ${l.subject}`);
    console.log(`Status   : ${l.status}  (payload.approvalStatus: ${approvalStatus})`);
    console.log(`Slides   : ${gen?.depthSlideCount ?? slideCount}  Words: ${gen?.depthWordCount ?? wordCount}`);
    console.log(`Updated  : ${l.updatedAt.toISOString()}`);
    if (gen?.regenerationJobId) {
      console.log(`Job ID   : ${gen.regenerationJobId}`);
    }
    const passCheck = ((gen?.depthSlideCount ?? slideCount) as number) >= (l.grade <= 6 ? 15 : 18) &&
                      ((gen?.depthWordCount ?? wordCount) as number) >= 1200;
    console.log(`Gate     : ${passCheck ? "✓ PASS" : "✗ FAIL"}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
