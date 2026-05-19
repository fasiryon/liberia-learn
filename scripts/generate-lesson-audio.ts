/**
 * Batch ElevenLabs audio generation for approved lessons.
 * Uploads MP3 to Supabase and stores URL in LessonAudio model.
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-lesson-audio.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject MATH
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --grade 7 --limit 20
 *
 * Rate limiting: ElevenLabs Starter = 30k chars/month, Creator = 100k/month.
 *   Turbo v2 = ~$0.30/1k chars on paid tier.
 *   Default --limit 50 processes ~50 lessons.
 *   Use --limit to run in batches and monitor quota in ElevenLabs dashboard.
 */
// Strip surrounding quotes added by some dotenv loaders (e.g. dotenv-cli with .env.local)
function cleanEnv(key: string) {
  if (process.env[key]) process.env[key] = process.env[key]!.replace(/^["']|["']$/g, "");
}
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
cleanEnv("DATABASE_URL");

import { prisma } from "@/lib/db";
import { selectLessonBody } from "@/lib/lessons";
import { generateSpeech, lessonToNarrationText, estimateElevenLabsCostUsd } from "@/lib/elevenlabs";
import { uploadBinaryToSupabase } from "@/lib/supabaseStorage";

const args = process.argv.slice(2);

function getArg(name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] ?? null : null;
}

const subjectFilter = getArg("subject")?.toUpperCase() ?? null;
const gradeFilter = getArg("grade") ? parseInt(getArg("grade")!, 10) : null;
const limit = getArg("limit") ? parseInt(getArg("limit")!, 10) : 50;

async function main() {
  console.log(`\nLiberiaLearn — ElevenLabs Batch Audio Generator`);
  console.log(`Filters: subject=${subjectFilter ?? "all"}, grade=${gradeFilter ?? "all"}, limit=${limit}\n`);

  const where: any = {
    status: "APPROVED",
  };
  if (subjectFilter) where.subject = subjectFilter;
  if (gradeFilter) where.grade = gradeFilter;

  const lessons = await prisma.curriculumContent.findMany({
    where,
    select: {
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      version: true,
      payload: true,
      audioAssets: {
        where: { status: "GENERATED" },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const toProcess = lessons.filter((l) => l.audioAssets.length === 0);
  const total = toProcess.length;
  const skipped = lessons.length - total;

  console.log(`Found ${lessons.length} APPROVED lessons, ${skipped} already have audio, processing ${total}\n`);

  let ok = 0;
  let fail = 0;
  let totalChars = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const l = toProcess[i];
    const label = `[${i + 1}/${total}] G${l.grade} ${l.subject} — ${l.title ?? l.contentId}`;

    const payload = l.payload as any;
    const bodyText = selectLessonBody(
      { body: payload?.body, body_standard: payload?.body_standard, body_block: payload?.body_block },
      "standard"
    );

    if (!bodyText || bodyText.length < 100) {
      console.log(`${label}: SKIP (no body text)`);
      continue;
    }

    const narrationText = lessonToNarrationText({
      title: l.title ?? l.subject,
      body_standard: payload?.body_standard,
      body: payload?.body,
    });

    try {
      await prisma.lessonAudio.upsert({
        where: {
          lessonId_contentVersion_voice: {
            lessonId: l.contentId,
            contentVersion: l.version,
            voice: "elevenlabs-rachel",
          },
        },
        update: { status: "PROCESSING", estimatedCostUsd: estimateElevenLabsCostUsd(narrationText) },
        create: {
          lessonId: l.contentId,
          contentVersion: l.version,
          voice: "elevenlabs-rachel",
          status: "PROCESSING",
          estimatedCostUsd: estimateElevenLabsCostUsd(narrationText),
        },
      });

      const mp3 = await generateSpeech(narrationText);

      const storagePath = `grade-${l.grade}/${l.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${l.contentId}/elevenlabs-part-1.mp3`;
      const storageUrl = await uploadBinaryToSupabase({
        bucket: process.env.SUPABASE_LESSON_AUDIO_BUCKET ?? "lesson-audio",
        path: storagePath,
        contentType: "audio/mpeg",
        body: mp3,
      });

      await prisma.lessonAudio.update({
        where: {
          lessonId_contentVersion_voice: {
            lessonId: l.contentId,
            contentVersion: l.version,
            voice: "elevenlabs-rachel",
          },
        },
        data: {
          status: "GENERATED",
          storageUrl,
          generatedAt: new Date(),
          audioParts: [
            { partNumber: 1, storageUrl, status: "GENERATED", charLength: narrationText.length },
          ],
        },
      });

      totalChars += narrationText.length;
      ok++;
      console.log(`${label}: OK (${narrationText.length} chars)`);
    } catch (err: any) {
      fail++;
      console.error(`${label}: FAIL — ${err.message}`);
      await prisma.lessonAudio.update({
        where: {
          lessonId_contentVersion_voice: {
            lessonId: l.contentId,
            contentVersion: l.version,
            voice: "elevenlabs-rachel",
          },
        },
        data: { status: "FAILED" },
      }).catch(() => {});
    }

    // 500ms delay between requests to respect rate limits
    if (i < toProcess.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  const estCost = estimateElevenLabsCostUsd(" ".repeat(totalChars));
  console.log(`\nDone: ${ok} OK | ${skipped} SKIP | ${fail} FAIL`);
  console.log(`Estimated cost: ${totalChars.toLocaleString()} chars used (~$${estCost.toFixed(4)})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
