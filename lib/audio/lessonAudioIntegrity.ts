import { createHash } from "crypto";

export const LESSON_AUDIO_GENERATOR_VERSION = "nr14-2026.1";
export const LESSON_AUDIO_LANGUAGE = "en";
export const LESSON_AUDIO_FORMAT = "mp3";

export type LessonAudioIntegrity = {
  sourceTextHash: string;
  assetSha256?: string;
  language: string;
  format: string;
  generatorVersion: string;
  byteLength?: number;
};

export function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildLessonAudioIntegrity(input: {
  sourceText: string;
  audio?: Uint8Array;
}): LessonAudioIntegrity {
  return {
    sourceTextHash: sha256Text(input.sourceText),
    ...(input.audio ? { assetSha256: sha256Bytes(input.audio), byteLength: input.audio.byteLength } : {}),
    language: LESSON_AUDIO_LANGUAGE,
    format: LESSON_AUDIO_FORMAT,
    generatorVersion: LESSON_AUDIO_GENERATOR_VERSION,
  };
}

export function readLessonAudioIntegrity(value: unknown): LessonAudioIntegrity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.sourceTextHash !== "string" ||
    typeof record.language !== "string" ||
    typeof record.format !== "string" ||
    typeof record.generatorVersion !== "string"
  ) return null;
  return {
    sourceTextHash: record.sourceTextHash,
    assetSha256: typeof record.assetSha256 === "string" ? record.assetSha256 : undefined,
    language: record.language,
    format: record.format,
    generatorVersion: record.generatorVersion,
    byteLength: typeof record.byteLength === "number" ? record.byteLength : undefined,
  };
}

export function readLessonAudioIntegrityFromParts(value: unknown): LessonAudioIntegrity | null {
  if (!Array.isArray(value)) return null;
  for (const part of value) {
    const integrity = readLessonAudioIntegrity(part);
    if (integrity) return integrity;
  }
  return null;
}

export function isLessonAudioIntegrityCurrent(value: unknown, sourceText: string): boolean {
  const integrity = readLessonAudioIntegrityFromParts(value);
  return Boolean(
    integrity &&
      integrity.assetSha256 &&
      integrity.sourceTextHash === sha256Text(sourceText) &&
      integrity.language === LESSON_AUDIO_LANGUAGE &&
      integrity.format === LESSON_AUDIO_FORMAT &&
      integrity.generatorVersion === LESSON_AUDIO_GENERATOR_VERSION,
  );
}
