import { config } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import {
  DEFAULT_TTS_VOICE,
  TTS_MODEL,
  estimateTtsCostUsd,
} from "@/lib/lessons/audioGeneration";
import { uploadLessonAudioToSupabase } from "@/lib/supabaseStorage";

config({ path: ".env.local" });
config();

const DEFAULT_LIMIT = 3;
const LOCAL_AUDIO_DIR = path.join(process.cwd(), "public", "generated-audio");

type LessonPayload = {
  title?: string;
  body?: string;
  body_standard?: string;
  audioScriptSpecs?: Array<{ script?: string; mode?: string; durationTargetSeconds?: number }>;
};

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";
}

export type ProcessLessonAudioOptions = {
  grade: number;
  subject: string;
  limit?: number;
  dryRun?: boolean;
  approved?: boolean;
  resume?: boolean;
  force?: boolean;
  includeUnmapped?: boolean;
  includePublished?: boolean;
  includeProcessing?: boolean;
  voice?: string;
  provider?: "openai";
  ttsClient?: { generateMp3(input: { text: string; voice: string }): Promise<Buffer> };
  storageClient?: { upload(input: { lessonId: string; contentVersion: string; body: Buffer }): Promise<string> };
};

export type ProcessLessonAudioResult = {
  provider: string;
  storage: string;
  dryRun: boolean;
  inspected: number;
  processed: number;
  skipped: number;
  failed: number;
  estimatedCostUsd: number;
  rows: Array<{ lessonId: string; status: string; url?: string; costUsd?: number; error?: string }>;
};

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value.trim() : undefined;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function normalizeSubject(subject: string) {
  return subject.trim().toUpperCase();
}

function asPayload(value: unknown): LessonPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as LessonPayload : {};
}

export function lessonAudioText(payloadValue: unknown) {
  const payload = asPayload(payloadValue);
  const scripts = Array.isArray(payload.audioScriptSpecs)
    ? payload.audioScriptSpecs.map((entry) => entry?.script?.trim()).filter(Boolean)
    : [];
  const text = scripts.length > 0 ? scripts.join("\n\n") : payload.body_standard ?? payload.body ?? "";
  return text.trim();
}

async function openAiTtsBuffer(input: { text: string; voice: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI TTS.");
  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({
    model: TTS_MODEL,
    voice: input.voice as "alloy",
    input: input.text,
    response_format: "mp3",
  });
  return Buffer.from(await response.arrayBuffer());
}

async function uploadAudio(input: { grade: number; subject: string; lessonId: string; voice: string; body: Buffer }) {
  try {
    return {
      storage: "supabase",
      url: await uploadLessonAudioToSupabase({
        grade: input.grade,
        subject: input.subject,
        contentId: input.lessonId,
        voice: input.voice,
        body: input.body,
      }),
    };
  } catch (error: any) {
    if (!String(error?.message ?? "").includes("Supabase storage is not configured")) throw error;
    if (isProductionRuntime()) {
      throw new Error("Supabase lesson audio storage is required in production.");
    }
    await mkdir(LOCAL_AUDIO_DIR, { recursive: true });
    const fileName = `${input.lessonId}-${input.voice}.mp3`.replace(/[^a-zA-Z0-9._-]/g, "-");
    await writeFile(path.join(LOCAL_AUDIO_DIR, fileName), input.body);
    return { storage: "public/generated-audio local/dev fallback - production storage still needed", url: `/generated-audio/${fileName}` };
  }
}

export async function processLessonAudioBatch(options: ProcessLessonAudioOptions): Promise<ProcessLessonAudioResult> {
  if (!options.dryRun && !options.approved) {
    throw new Error("Refusing writes: run a dry-run first, then pass --approved for an approved write run.");
  }

  const subject = normalizeSubject(options.subject);
  const limit = Math.min(25, Math.max(1, options.limit ?? DEFAULT_LIMIT));
  const voice = options.voice ?? DEFAULT_TTS_VOICE;
  const provider = options.provider ?? "openai";
  if (provider !== "openai") throw new Error(`Unsupported TTS provider: ${provider}`);

  const audioWhere = options.force
    ? { voice }
    : { voice, status: options.includeProcessing ? { in: ["PENDING", "PROCESSING"] } : "PENDING" };
  const mappedWhere = options.includeUnmapped
    ? {}
    : {
        unitId: { not: null },
        orderInUnit: { not: null },
      };

  const lessons = await prisma.curriculumContent.findMany({
    where: {
      grade: options.grade,
      subject,
      contentType: "lesson",
      status: options.includePublished ? { in: ["APPROVED", "published"] } : "APPROVED",
      ...mappedWhere,
      audioAssets: { some: audioWhere },
    },
    orderBy: [{ unitId: "asc" }, { orderInUnit: "asc" }, { updatedAt: "asc" }],
    take: limit,
    select: {
      contentId: true,
      version: true,
      payload: true,
      audioAssets: {
        where: { voice },
        orderBy: { generatedAt: "desc" },
        take: 1,
        select: { id: true, status: true, storageUrl: true, contentVersion: true, voice: true },
      },
    },
  });

  const rows: ProcessLessonAudioResult["rows"] = [];
  let storage = "not used";
  let estimatedCostUsd = 0;

  for (const lesson of lessons) {
    const audio = lesson.audioAssets[0];
    if (!audio) {
      rows.push({ lessonId: lesson.contentId, status: "SKIPPED", error: "No matching LessonAudio row." });
      continue;
    }
    if (audio.status === "GENERATED" && !options.force) {
      rows.push({ lessonId: lesson.contentId, status: "SKIPPED", url: audio.storageUrl ?? undefined });
      continue;
    }

    const text = lessonAudioText(lesson.payload);
    const costUsd = estimateTtsCostUsd(text);
    estimatedCostUsd += costUsd;
    if (!text) {
      rows.push({ lessonId: lesson.contentId, status: "FAILED", costUsd, error: "Lesson has no audio script or readable body." });
      if (!options.dryRun) await prisma.lessonAudio.update({ where: { id: audio.id }, data: { status: "FAILED" } });
      continue;
    }

    if (options.dryRun) {
      rows.push({ lessonId: lesson.contentId, status: "DRY_RUN", costUsd });
      continue;
    }

    try {
      await prisma.lessonAudio.update({
        where: { id: audio.id },
        data: { status: "PROCESSING", estimatedCostUsd: costUsd, generatedAt: new Date(), voice },
      });
      const mp3 = await (options.ttsClient?.generateMp3({ text, voice }) ?? openAiTtsBuffer({ text, voice }));
      const uploaded = options.storageClient
        ? { storage: "injected test storage", url: await options.storageClient.upload({ lessonId: lesson.contentId, contentVersion: lesson.version, body: mp3 }) }
        : await uploadAudio({ grade: options.grade, subject, lessonId: lesson.contentId, voice, body: mp3 });
      storage = uploaded.storage;
      await prisma.lessonAudio.update({
        where: { id: audio.id },
        data: {
          status: "GENERATED",
          storageUrl: uploaded.url,
          generatedAt: new Date(),
          estimatedCostUsd: costUsd,
          durationSeconds: asPayload(lesson.payload).audioScriptSpecs?.reduce((sum, entry) => sum + Number(entry.durationTargetSeconds ?? 0), 0) || null,
        },
      });
      rows.push({ lessonId: lesson.contentId, status: "GENERATED", url: uploaded.url, costUsd });
    } catch (error: any) {
      const message = error?.message ?? "Audio generation failed.";
      await prisma.lessonAudio.update({ where: { id: audio.id }, data: { status: "FAILED" } }).catch(() => {});
      rows.push({ lessonId: lesson.contentId, status: "FAILED", costUsd, error: message });
    }
  }

  const processed = rows.filter((row) => row.status === "GENERATED" || row.status === "DRY_RUN").length;
  const failed = rows.filter((row) => row.status === "FAILED").length;
  return {
    provider,
    storage,
    dryRun: Boolean(options.dryRun),
    inspected: lessons.length,
    processed,
    skipped: rows.filter((row) => row.status === "SKIPPED").length,
    failed,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    rows,
  };
}

async function main() {
  const grade = Number.parseInt(readArg("--grade") ?? "", 10);
  const subject = readArg("--subject");
  if (!Number.isFinite(grade) || !subject) throw new Error("--grade and --subject are required.");
  const result = await processLessonAudioBatch({
    grade,
    subject,
    limit: Number.parseInt(readArg("--limit") ?? String(DEFAULT_LIMIT), 10),
    dryRun: hasFlag("--dry-run"),
    approved: hasFlag("--approved"),
    resume: hasFlag("--resume"),
    force: hasFlag("--force"),
    includeUnmapped: hasFlag("--include-unmapped"),
    includePublished: hasFlag("--include-published"),
    includeProcessing: hasFlag("--include-processing"),
    voice: readArg("--voice") ?? DEFAULT_TTS_VOICE,
    provider: (readArg("--provider") ?? "openai") as "openai",
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error?.message ?? error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
