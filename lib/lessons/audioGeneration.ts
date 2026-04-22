import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { logAIInteraction } from "@/lib/ai/interactionLog";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";
import { uploadBinaryToSupabase } from "@/lib/supabaseStorage";

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
}) {
  return `lessons/audio/${input.lessonId}/${input.contentVersion}.mp3`;
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
  schoolId?: string | null;
  userId?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for direct lesson audio generation.");
  }

  const voice = input.voice ?? DEFAULT_TTS_VOICE;
  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({
    model: TTS_MODEL,
    voice: voice as "alloy",
    input: input.text,
    response_format: "mp3",
  });

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const path = lessonAudioStoragePath({
    lessonId: input.lessonId,
    contentVersion: input.contentVersion,
  });
  const storageUrl = await uploadBinaryToSupabase({
    bucket: LESSON_AUDIO_BUCKET,
    path,
    contentType: "audio/mpeg",
    body: audioBuffer,
  });
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
      storageUrl,
      status: "GENERATED",
      generatedAt: new Date(),
      estimatedCostUsd,
    },
    create: {
      lessonId: input.lessonId,
      contentVersion: input.contentVersion,
      voice,
      storageUrl,
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
    metadata: { voice, byteLength: audioBuffer.byteLength },
  });

  return record;
}
