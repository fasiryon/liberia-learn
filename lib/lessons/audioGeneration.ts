import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { logAIInteraction } from "@/lib/ai/interactionLog";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";
import { uploadBinaryToSupabase } from "@/lib/supabaseStorage";
import { chunkTextForTTS } from "@/lib/audio/chunkText";

export const LESSON_AUDIO_BUCKET = "lesson-audio";
export const DEFAULT_TTS_VOICE = "alloy";
export const TTS_MODEL = "tts-1";

type AudioStatus = "NOT_GENERATED" | "PENDING" | "GENERATED" | "STALE" | "FAILED";

export function estimateTtsCostUsd(text: string) {
  const chars = Math.max(0, text.length);
  return Number(((chars / 1_000_000) * 15).toFixed(6));
}

export function lessonAudioStoragePath(input: {
  lessonId: string;
  contentVersion: string;
  grade?: number;
  subject?: string;
  partNumber?: number;
}) {
  if (input.grade && input.subject && input.partNumber) {
    const safeSubject = input.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const safeLessonId = input.lessonId.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
    return `grade-${input.grade}/${safeSubject}/${safeLessonId}/part-${input.partNumber}.mp3`;
  }
  return `lessons/audio/${input.lessonId}/${input.contentVersion}.mp3`;
}

type AudioPart = {
  partNumber: number;
  storageUrl?: string;
  status: "GENERATED" | "FAILED";
  charLength: number;
  error?: string;
};

function parseAudioParts(value: unknown): AudioPart[] {
  return Array.isArray(value)
    ? value.filter((part): part is AudioPart => {
        const p = part as AudioPart;
        return Number.isFinite(Number(p.partNumber)) && Number.isFinite(Number(p.charLength));
      })
    : [];
}

export async function getCurrentLessonAudio(lessonId: string, contentVersion: string, voice = DEFAULT_TTS_VOICE) {
  const audio = await prisma.lessonAudio.findFirst({
    where: { lessonId, voice },
    orderBy: { generatedAt: "desc" },
  });
  if (!audio) return { status: "NOT_GENERATED" as AudioStatus, audio: null };
  if (audio.contentVersion !== contentVersion && audio.status === "GENERATED") {
    return { status: "STALE" as AudioStatus, audio };
  }
  return { status: audio.status as AudioStatus, audio };
}

export async function queueLessonAudioGeneration(input: {
  lessonId: string;
  contentVersion: string;
  voice?: string;
  schoolId?: string | null;
  userId?: string | null;
  text: string;
}) {
  const voice = input.voice ?? DEFAULT_TTS_VOICE;
  const existing = await prisma.lessonAudio.findUnique({
    where: {
      lessonId_contentVersion_voice: {
        lessonId: input.lessonId,
        contentVersion: input.contentVersion,
        voice,
      },
    },
  });
  if (existing?.status === "GENERATED") return existing;

  const estimatedCostUsd = estimateTtsCostUsd(input.text);
  const record = await prisma.lessonAudio.upsert({
    where: {
      lessonId_contentVersion_voice: {
        lessonId: input.lessonId,
        contentVersion: input.contentVersion,
        voice,
      },
    },
    update: {
      status: existing?.status === "GENERATED" ? existing.status : "PENDING",
      estimatedCostUsd,
    },
    create: {
      lessonId: input.lessonId,
      contentVersion: input.contentVersion,
      voice,
      status: "PENDING",
      estimatedCostUsd,
    },
  });

  await logAIInteraction({
    route: "/api/admin/curriculum/audio",
    feature: "curriculum",
    schoolId: input.schoolId ?? null,
    userId: input.userId ?? null,
    contentId: input.lessonId,
    lessonId: input.lessonId,
    requestType: "tts_generation_queued",
    model: TTS_MODEL,
    provider: "openai",
    estimatedCostUSD: estimatedCostUsd,
    contentVersion: input.contentVersion,
    metadata: { voice, status: "PENDING" },
  });

  if (isQueueConfigured()) {
    await enqueueJob(JobType.GENERATE_LESSON_AUDIO, {
      lessonId: input.lessonId,
      contentVersion: input.contentVersion,
      voice,
    });
  }

  return record;
}

export async function generateLessonAudioNow(input: {
  lessonId: string;
  contentVersion: string;
  voice?: string;
  text: string;
  grade?: number;
  subject?: string;
  schoolId?: string | null;
  userId?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for direct lesson audio generation.");
  }

  const voice = input.voice ?? DEFAULT_TTS_VOICE;
  const estimatedCostUsd = estimateTtsCostUsd(input.text);
  const chunks = chunkTextForTTS(input.text);
  if (chunks.length === 0) {
    throw new Error("Lesson has no readable text.");
  }
  const existing = await prisma.lessonAudio.findUnique({
    where: {
      lessonId_contentVersion_voice: {
        lessonId: input.lessonId,
        contentVersion: input.contentVersion,
        voice,
      },
    },
  });
  if (existing?.status === "GENERATED" && existing.storageUrl) {
    return existing;
  }
  const existingParts = parseAudioParts(existing?.audioParts);

  await prisma.lessonAudio.upsert({
    where: {
      lessonId_contentVersion_voice: {
        lessonId: input.lessonId,
        contentVersion: input.contentVersion,
        voice,
      },
    },
    update: {
      status: "PROCESSING",
      generatedAt: new Date(),
      estimatedCostUsd,
    },
    create: {
      lessonId: input.lessonId,
      contentVersion: input.contentVersion,
      voice,
      storageUrl: "",
      status: "PROCESSING",
      generatedAt: new Date(),
      estimatedCostUsd,
    },
  });

  const client = new OpenAI({ apiKey });
  const audioParts: AudioPart[] = [];
  let totalBytes = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const partNumber = index + 1;
    const existingPart = existingParts.find((part) => part.partNumber === partNumber);
    if (existingPart?.status === "GENERATED" && existingPart.storageUrl) {
      audioParts.push(existingPart);
      continue;
    }

    try {
      const response = await client.audio.speech.create({
        model: TTS_MODEL,
        voice: voice as "alloy",
        input: chunks[index],
        response_format: "mp3",
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      totalBytes += audioBuffer.byteLength;
      const path = lessonAudioStoragePath({
        lessonId: input.lessonId,
        contentVersion: input.contentVersion,
        grade: input.grade,
        subject: input.subject,
        partNumber,
      });
      const storageUrl = await uploadBinaryToSupabase({
        bucket: LESSON_AUDIO_BUCKET,
        path,
        contentType: "audio/mpeg",
        body: audioBuffer,
      });
      audioParts.push({ partNumber, storageUrl, status: "GENERATED", charLength: chunks[index].length });
    } catch (error: any) {
      const message = error?.message ?? "Audio part generation failed.";
      const failedParts = [
        ...audioParts,
        { partNumber, status: "FAILED" as const, charLength: chunks[index].length, error: message },
      ];
      await prisma.lessonAudio.upsert({
        where: {
          lessonId_contentVersion_voice: {
            lessonId: input.lessonId,
            contentVersion: input.contentVersion,
            voice,
          },
        },
        update: { status: "FAILED", audioParts: failedParts, estimatedCostUsd },
        create: {
          lessonId: input.lessonId,
          contentVersion: input.contentVersion,
          voice,
          status: "FAILED",
          audioParts: failedParts,
          estimatedCostUsd,
        },
      });
      throw new Error(`Audio part ${partNumber} failed: ${message}`);
    }
  }

  const storageUrl = audioParts[0]?.storageUrl ?? "";
  const record = await prisma.lessonAudio.upsert({
    where: {
      lessonId_contentVersion_voice: {
        lessonId: input.lessonId,
        contentVersion: input.contentVersion,
        voice,
      },
    },
    update: {
      storageUrl,
      audioParts,
      status: "GENERATED",
      generatedAt: new Date(),
      estimatedCostUsd,
    },
    create: {
      lessonId: input.lessonId,
      contentVersion: input.contentVersion,
      voice,
      storageUrl,
      audioParts,
      status: "GENERATED",
      generatedAt: new Date(),
      estimatedCostUsd,
    },
  });

  await logAIInteraction({
    route: "/worker/lesson-audio",
    feature: "curriculum",
    schoolId: input.schoolId ?? null,
    userId: input.userId ?? null,
    contentId: input.lessonId,
    lessonId: input.lessonId,
    requestType: "tts_generation_completed",
    model: TTS_MODEL,
    provider: "openai",
    estimatedCostUSD: estimatedCostUsd,
    contentVersion: input.contentVersion,
    metadata: { voice, byteLength: totalBytes, partCount: audioParts.length },
  });

  return record;
}

export async function processPendingLessonAudio(limit = 1) {
  const pending = await prisma.lessonAudio.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { generatedAt: "asc" },
    take: Math.min(10, Math.max(1, limit)),
    include: {
      lesson: {
        select: {
          contentId: true,
          version: true,
          grade: true,
          subject: true,
          payload: true,
        },
      },
    },
  });

  const results: Array<{ lessonId: string; status: string; error?: string }> = [];
  for (const row of pending) {
    try {
      const payload = row.lesson.payload as { body_standard?: string; body?: string; title?: string } | null;
      const text = payload?.body_standard ?? payload?.body ?? "";
      if (!text.trim()) {
        await prisma.lessonAudio.update({ where: { id: row.id }, data: { status: "FAILED" } });
        results.push({ lessonId: row.lessonId, status: "FAILED", error: "Lesson has no readable text." });
        continue;
      }
      await generateLessonAudioNow({
        lessonId: row.lessonId,
        contentVersion: row.contentVersion,
        voice: row.voice,
        text,
        grade: (row.lesson as any).grade,
        subject: (row.lesson as any).subject,
      });
      results.push({ lessonId: row.lessonId, status: "GENERATED" });
    } catch (error: any) {
      await prisma.lessonAudio.update({ where: { id: row.id }, data: { status: "FAILED" } }).catch(() => {});
      results.push({ lessonId: row.lessonId, status: "FAILED", error: error?.message ?? "Audio generation failed." });
    }
  }
  return results;
}
