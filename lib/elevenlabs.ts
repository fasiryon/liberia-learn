/**
 * ElevenLabs TTS integration for lesson audio narration.
 * Integrates with the existing LessonAudio model and audioGeneration pipeline.
 *
 * Voice IDs: https://api.elevenlabs.io/v1/voices
 * Default: Rachel (21m00Tcm4TlvDq8ikWAM) — natural, clear, suited for education
 * Override with ELEVENLABS_VOICE_ID env var.
 */

export const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

export const ELEVENLABS_MODEL = "eleven_turbo_v2"; // fastest + cheapest for batch
export const ELEVENLABS_MAX_CHARS = 4800; // hard limit: 5000; leave 200 buffer

export async function generateSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs error ${res.status}: ${err}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Prepare lesson text for TTS. Strips HTML, normalises whitespace,
 * and truncates at a sentence boundary near the 4800-char limit.
 */
export function lessonToNarrationText(lesson: {
  title: string;
  body_standard?: string | null;
  body?: string | null;
}): string {
  const raw = lesson.body_standard ?? lesson.body ?? "";
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const titled = `${lesson.title}. ${text}`;
  if (titled.length <= ELEVENLABS_MAX_CHARS) return titled;

  // Truncate at sentence boundary
  const truncated = titled.slice(0, ELEVENLABS_MAX_CHARS).replace(/[^.!?]*$/, "");
  return truncated || titled.slice(0, ELEVENLABS_MAX_CHARS);
}

/** Rough char-based cost estimate for ElevenLabs (turbo_v2: ~$0.0003/1k chars) */
export function estimateElevenLabsCostUsd(text: string): number {
  return Number(((text.length / 1_000) * 0.0003).toFixed(6));
}
