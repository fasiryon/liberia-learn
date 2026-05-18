/**
 * Diagnostic: identifies which payload field holds 3000+ word content.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/diagnose-lesson-viewer.ts
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { prisma } from "@/lib/db";

async function main() {
  const lessons = await prisma.curriculumContent.findMany({
    where: { status: "APPROVED" },
    select: {
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      version: true,
      payload: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  console.log(`\nChecking ${lessons.length} most-recently-updated APPROVED lessons:\n`);

  let longestField = "";
  let longestLen = 0;

  for (const l of lessons) {
    const p = l.payload as any;
    const bodyLen = typeof p?.body === "string" ? p.body.length : null;
    const stdLen = typeof p?.body_standard === "string" ? p.body_standard.length : null;
    const blkLen = typeof p?.body_block === "string" ? p.body_block.length : null;
    const hasSlides = Array.isArray(p?.slides);
    const hasLessons = Array.isArray(p?.lessons);
    const payloadType = typeof p;
    const payloadKeys = p && typeof p === "object" ? Object.keys(p).join(", ") : "N/A";

    const maxLen = Math.max(bodyLen ?? 0, stdLen ?? 0, blkLen ?? 0);
    if (maxLen > longestLen) {
      longestLen = maxLen;
      longestField = bodyLen === maxLen ? "body" : stdLen === maxLen ? "body_standard" : "body_block";
    }

    console.log(`G${l.grade} ${l.subject}: ${l.title}`);
    console.log(`  payload type    : ${payloadType}`);
    console.log(`  payload keys    : ${payloadKeys}`);
    console.log(`  body            : ${bodyLen !== null ? `${bodyLen} chars` : "null"}`);
    console.log(`  body_standard   : ${stdLen !== null ? `${stdLen} chars` : "null"}`);
    console.log(`  body_block      : ${blkLen !== null ? `${blkLen} chars` : "null"}`);
    console.log(`  slides array    : ${hasSlides ? (p.slides as any[]).length + " items" : "null"}`);
    console.log(`  lessons array   : ${hasLessons ? (p.lessons as any[]).length + " items" : "null"}`);
    if (maxLen > 0) {
      const words = (bodyLen === maxLen ? p.body : stdLen === maxLen ? p.body_standard : p.body_block)
        .replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      console.log(`  longest field   : ${longestField === (bodyLen === maxLen ? "body" : stdLen === maxLen ? "body_standard" : "body_block") ? "↑" : ""} ~${words} words`);
    }
    console.log();
  }

  console.log(`\n✅ Primary content field: "${longestField}" (${longestLen} chars)`);
  console.log(`   Viewer reads via selectLessonBody: body_standard ?? body_block ?? body`);
  console.log(`   If this field is populated, the viewer SHOULD render full content.\n`);

  // Check if any approved lesson is scheduled for a class today
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const scheduled = await prisma.scheduledWork.count({
    where: { scheduledDate: { gte: today }, content: { status: "APPROVED" } },
  });
  console.log(`Scheduled work items today (pointing to APPROVED content): ${scheduled}`);

  // Check audio coverage
  const total = await prisma.curriculumContent.count({ where: { status: "APPROVED" } });
  const withAudio = await prisma.lessonAudio.count({ where: { status: "GENERATED" } });
  const pending = await prisma.lessonAudio.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } });
  console.log(`\nAudio coverage:`);
  console.log(`  APPROVED lessons total : ${total}`);
  console.log(`  Audio GENERATED        : ${withAudio}`);
  console.log(`  Audio PENDING/PROCESSING: ${pending}`);
  console.log(`  No audio               : ${total - withAudio - pending}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
