/**
 * Batch ElevenLabs audio generation for approved lessons.
 * Uploads MP3 to Supabase and stores URL in LessonAudio model.
 *
 * Usage:
 *   npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts
 *   npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject MATH
 *   npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --grade G1 --limit 40
 *
 * Requires env vars: ELEVENLABS_API_KEY, DIRECT_URL (DB), SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).
 *   See docs/ops/NR14_AUDIO_PIPELINE.md for full setup.
 *
 * Rate limiting: Check https://elevenlabs.io/app/subscription for quota.
 *   Max chars/request: 4,800 (eleven_turbo_v2).
 *   Default --limit 50 processes ~50 lessons per run.
 *   Accepts --grade as "G1" or "1" (both work).
 */
// Strip surrounding quotes added by some dotenv loaders (e.g. dotenv-cli with .env.local)
function cleanEnv(key: string) {
  if (process.env[key]) process.env[key] = process.env[key]!.replace(/^["']|["']$/g, "");
}
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
cleanEnv("DATABASE_URL");

import { prisma } from "@/lib/db";
import { selectLessonBody } from "@/lib/lessons";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { generateSpeech, estimateElevenLabsCostUsd } from "@/lib/elevenlabs";
import { uploadBinaryToSupabase } from "@/lib/supabaseStorage";
import { buildLessonAudioIntegrity } from "@/lib/audio/lessonAudioIntegrity";

const args = process.argv.slice(2);

function getArg(name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] ?? null : null;
}

const subjectFilter = getArg("subject")?.toUpperCase() ?? null;
// Accept both "G1" and "1" formats; grade is Int in DB
const rawGrade = getArg("grade");
const gradeFilter = rawGrade
  ? parseInt(rawGrade.replace(/^[Gg]/, ""), 10)
  : null;
const limit = getArg("limit") ? parseInt(getArg("limit")!, 10) : 50;

async function main() {
  console.log(`\nLiberiaLearn — ElevenLabs Batch Audio Generator`);
  console.log(`Filters: subject=${subjectFilter ?? "all"}, grade=${gradeFilter ?? "all"}, limit=${limit}\n`);

  const where: any = {
    status: "APPROVED",
    // Only fetch lessons without a GENERATED audio record
    audioAssets: { none: { status: "GENERATED" } },
  };
  if (subjectFilter) where.subject = subjectFilter;
  if (gradeFilter !== null && !isNaN(gradeFilter)) where.grade = gradeFilter;

  const toProcess = await prisma.curriculumContent.findMany({
    where,
    select: {
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      version: true,
      payload: true,
    },
    orderBy: { grade: "asc" },
    take: limit,
  });

  const total = toProcess.length;

  console.log(`Found ${total} APPROVED lessons without audio (limit=${limit})\n`);

  let ok = 0;
  let fail = 0;
  let totalChars = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const l = toProcess[i];
    const label = `[${i + 1}/${total}] G${l.grade} ${l.subject} — ${l.title ?? l.contentId}`;

    const payload = l.payload as any;
    const studentPayload = projectStudentLessonPayload(payload);
    const bodyText = selectLessonBody(
      {
        body: studentPayload.body as string | undefined,
        body_standard: studentPayload.body_standard as string | undefined,
        body_block: studentPayload.body_block as string | undefined,
      },
      "standard"
    );

    if (!bodyText || bodyText.length < 100) {
      console.log(`${label}: SKIP (no body text)`);
      continue;
    }

    const narrationText = bodyText;

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
            {
              partNumber: 1,
              storageUrl,
              status: "GENERATED",
              charLength: narrationText.length,
              ...buildLessonAudioIntegrity({ sourceText: narrationText, audio: mp3 }),
            },
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
  console.log(`\nDone: ${ok} OK | ${fail} FAIL`);
  console.log(`Estimated cost: ${totalChars.toLocaleString()} chars used (~$${estCost.toFixed(4)})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
